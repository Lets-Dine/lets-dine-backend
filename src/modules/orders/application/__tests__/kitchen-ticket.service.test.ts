import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test } from "@nestjs/testing";
import { KitchenStation, OrderItemStatus, OrderStatus } from "@prisma/client";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { KitchenTicketRepository } from "../../domain/repositories/kitchen-ticket.repository";
import { PrinterRepository } from "../../../printers/domain/repositories/printer.repository";
import { PrintJobRepository } from "../../domain/repositories/print-job.repository";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { KITCHEN_TICKET_CREATED, KitchenTicketService } from "../kitchen-ticket.service";

const tx = {} as any;
const item = (over: any = {}) => ({
  id: "i1",
  dishId: "d1",
  quantity: 1,
  status: OrderItemStatus.PENDING,
  dishNameSnapshot: "Momo",
  variantNameSnapshot: null,
  notes: "",
  addOns: [],
  ...over,
});
const sent = (qtyDelta: number) => ({
  orderItemId: "i1",
  qtyDelta,
  station: KitchenStation.KITCHEN,
  dishNameSnapshot: "Momo",
  variantNameSnapshot: null,
  addOnNames: [],
  notes: "",
});

describe("KitchenTicketService", () => {
  let service: KitchenTicketService;
  let orders: { findById: jest.Mock };
  let tickets: { findSentLines: jest.Mock; create: jest.Mock; detachItem: jest.Mock };
  let events: { emit: jest.Mock };
  let printers: { findByBranch: jest.Mock };
  let printJobs: { createMany: jest.Mock };

  beforeEach(async () => {
    orders = { findById: jest.fn() };
    tickets = { findSentLines: jest.fn().mockResolvedValue([]), create: jest.fn(async d => ({ id: "t", ...d })), detachItem: jest.fn() };
    events = { emit: jest.fn() };
    printers = { findByBranch: jest.fn().mockResolvedValue([]) };
    printJobs = { createMany: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        KitchenTicketService,
        { provide: OrderRepository, useValue: orders },
        { provide: DishRepository, useValue: { findManyByIds: jest.fn().mockResolvedValue([{ id: "d1", station: KitchenStation.BAR }]) } },
        { provide: KitchenTicketRepository, useValue: tickets },
        { provide: PrinterRepository, useValue: printers },
        { provide: PrintJobRepository, useValue: printJobs },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = module.get(KitchenTicketService);
  });

  it("sends nothing for a PENDING order — accepting it sends everything", async () => {
    orders.findById.mockResolvedValue({ id: "o", branchId: "b", status: OrderStatus.PENDING, items: [item()] });
    expect(await service.reconcile("o", tx)).toEqual([]);
    expect(tickets.create).not.toHaveBeenCalled();
  });

  it("sends a ticket on the dish's station once the order is accepted", async () => {
    orders.findById.mockResolvedValue({ id: "o", branchId: "b", status: OrderStatus.ACCEPTED, items: [item()] });
    await service.reconcile("o", tx);
    expect(tickets.create).toHaveBeenCalledWith(
      expect.objectContaining({ station: KitchenStation.BAR, lines: [expect.objectContaining({ qtyDelta: 1 })] }),
      { tx }
    );
  });

  it("hands the screen each line's current status, so a live ticket reads the same as a fetched one", async () => {
    orders.findById.mockResolvedValue({ id: "o", branchId: "b", status: OrderStatus.ACCEPTED, items: [item()] });
    const [ticket] = await service.reconcile("o", tx);
    expect(ticket.lines[0].itemStatus).toBe(OrderItemStatus.PENDING);
  });

  it("still voids when the cancel is what completed the order", async () => {
    orders.findById.mockResolvedValue({
      id: "o",
      branchId: "b",
      status: OrderStatus.COMPLETED,
      items: [item({ status: OrderItemStatus.CANCELLED })],
    });
    tickets.findSentLines.mockResolvedValue([sent(1)]);
    await service.reconcile("o", tx);
    expect(tickets.create).toHaveBeenCalledWith(expect.objectContaining({ lines: [expect.objectContaining({ qtyDelta: -1 })] }), { tx });
  });

  it("announces each ticket on the event bus", () => {
    service.announce([{ id: "t1" } as any, { id: "t2" } as any]);
    expect(events.emit).toHaveBeenCalledTimes(2);
    expect(events.emit).toHaveBeenCalledWith(KITCHEN_TICKET_CREATED, { id: "t1" });
  });

  it("queues a slip for each printer the tickets route to, in the same transaction", async () => {
    orders.findById.mockResolvedValue({
      id: "o",
      branchId: "b",
      tableId: "t1",
      floorId: null,
      status: OrderStatus.ACCEPTED,
      items: [item()],
    });
    printers.findByBranch.mockResolvedValue([
      { id: "bar", fullKot: false, stations: [KitchenStation.BAR], tableAssignment: false, tableIds: [], floorIds: [] },
      { id: "kitchen", fullKot: false, stations: [KitchenStation.KITCHEN], tableAssignment: false, tableIds: [], floorIds: [] },
    ]);
    await service.reconcile("o", tx);
    // The dish is on the BAR station, so only the bar printer gets a job.
    expect(printJobs.createMany).toHaveBeenCalledWith([expect.objectContaining({ printerId: "bar", branchId: "b", orderId: "o" })], { tx });
  });

  it("queues nothing when no ticket was produced", async () => {
    orders.findById.mockResolvedValue({ id: "o", branchId: "b", status: OrderStatus.ACCEPTED, items: [] });
    await service.reconcile("o", tx);
    expect(printJobs.createMany).not.toHaveBeenCalled();
  });
});
