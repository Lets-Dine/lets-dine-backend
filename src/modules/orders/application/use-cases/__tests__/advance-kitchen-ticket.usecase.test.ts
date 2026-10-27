import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test } from "@nestjs/testing";
import { OrderItemStatus } from "@prisma/client";
import { BadRequestException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { KitchenTicketRepository } from "../../../domain/repositories/kitchen-ticket.repository";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { KITCHEN_TICKET_READY, KITCHEN_TICKET_UPDATED } from "../../kitchen-ticket.service";
import { AdvanceKitchenTicketUsecase } from "../advance-kitchen-ticket.usecase";
import { AdvanceOrderItemStatusUsecase } from "../advance-order-item-status.usecase";

const authUser = buildAuthEntity();
const line = (orderItemId: string | null, qtyDelta = 1) => ({ id: `l-${orderItemId}`, orderItemId, qtyDelta });

describe("AdvanceKitchenTicketUsecase", () => {
  let usecase: AdvanceKitchenTicketUsecase;
  let tickets: { findById: jest.Mock; acknowledge: jest.Mock };
  let orders: { findById: jest.Mock };
  let advanceItem: { execute: jest.Mock };
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    tickets = { findById: jest.fn(), acknowledge: jest.fn() };
    orders = { findById: jest.fn() };
    advanceItem = { execute: jest.fn() };
    events = { emit: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        AdvanceKitchenTicketUsecase,
        { provide: KitchenTicketRepository, useValue: tickets },
        { provide: OrderRepository, useValue: orders },
        { provide: AdvanceOrderItemStatusUsecase, useValue: advanceItem },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    usecase = module.get(AdvanceKitchenTicketUsecase);
  });

  const ticket = (lines: any[], acknowledgedAt: Date | null = null) => ({
    id: "t",
    orderId: "o",
    branchId: authUser.branchId,
    acknowledgedAt,
    lines,
  });

  it("walks a PENDING line through PREPARING to READY, acknowledges, and tells the floor", async () => {
    tickets.findById.mockResolvedValue(ticket([line("i1")]));
    orders.findById.mockResolvedValue({ id: "o", items: [{ id: "i1", status: OrderItemStatus.PENDING }] });
    await usecase.execute("t", { status: OrderItemStatus.READY }, authUser);
    expect(advanceItem.execute.mock.calls.map(c => c[2].status)).toEqual([OrderItemStatus.PREPARING, OrderItemStatus.READY]);
    expect(tickets.acknowledge).toHaveBeenCalled();
    expect(events.emit).toHaveBeenCalledWith(KITCHEN_TICKET_UPDATED, expect.anything());
    expect(events.emit).toHaveBeenCalledWith(KITCHEN_TICKET_READY, expect.anything());
  });

  it("starting only moves to PREPARING and does not tell the floor it is ready", async () => {
    tickets.findById.mockResolvedValue(ticket([line("i1")]));
    orders.findById.mockResolvedValue({ id: "o", items: [{ id: "i1", status: OrderItemStatus.PENDING }] });
    await usecase.execute("t", { status: OrderItemStatus.PREPARING }, authUser);
    expect(advanceItem.execute).toHaveBeenCalledTimes(1);
    expect(events.emit).not.toHaveBeenCalledWith(KITCHEN_TICKET_READY, expect.anything());
  });

  it("skips lines already past the step or cancelled instead of failing", async () => {
    tickets.findById.mockResolvedValue(ticket([line("i1"), line("i2"), line("i3")], new Date()));
    orders.findById.mockResolvedValue({
      id: "o",
      items: [
        { id: "i1", status: OrderItemStatus.READY },
        { id: "i2", status: OrderItemStatus.CANCELLED },
        { id: "i3", status: OrderItemStatus.PREPARING },
      ],
    });
    await usecase.execute("t", { status: OrderItemStatus.READY }, authUser);
    expect(advanceItem.execute).toHaveBeenCalledTimes(1);
    expect(advanceItem.execute).toHaveBeenCalledWith("o", "i3", { status: OrderItemStatus.READY }, authUser);
    expect(tickets.acknowledge).not.toHaveBeenCalled();
  });

  it("refuses a cancellation ticket — nothing to start or finish", async () => {
    tickets.findById.mockResolvedValue(ticket([line("i1", -1), line(null)]));
    await expect(usecase.execute("t", { status: OrderItemStatus.READY }, authUser)).rejects.toThrow(BadRequestException);
  });
});
