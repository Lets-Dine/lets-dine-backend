import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AuditAction, OrderItemStatus, OrderStatus } from "@prisma/client";
import { UnauthorizedException } from "../../../../common/exceptions";
import { buildAuthEntity } from "../../../../common/testing";
import { OrderRepository } from "../../../orders/domain/repositories/order.repository";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DINING_SESSION_ERROR_MESSAGES } from "../../domain/constants";
import { DiningSessionRepository } from "../../domain/repositories/dining-session.repository";
import { DiningSessionService } from "../dining-session.service";

const authUser = buildAuthEntity();
const tx = {} as any;
const session = { id: "session-1", tableId: "table-1" };
const restaurant = { id: authUser.restaurantId, serviceChargeRate: 0.1, taxRate: 0.13 };

interface FakeItem {
  id: string;
  dishId: string;
  unitPrice: number;
  quantity: number;
  status: OrderItemStatus;
}

function item(overrides: Partial<FakeItem> = {}): FakeItem {
  return { id: "item-1", dishId: "dish-1", unitPrice: 100, quantity: 1, status: OrderItemStatus.PENDING, ...overrides };
}

function order(overrides: Record<string, unknown> = {}) {
  return { id: "order-1", discount: 0, acceptedAt: new Date(), cancelledAt: null, items: [item()], ...overrides } as any;
}

/** Mimics the repository's real behaviour: each call mutates one line and hands back the order's full, current item list. */
function trackingUpdateItemStatus(items: FakeItem[]) {
  return jest.fn(async (itemId: string, status: OrderItemStatus) => {
    const index = items.findIndex(candidate => candidate.id === itemId);
    items[index] = { ...items[index], status };
    return { id: "order-1", items: [...items] } as any;
  });
}

describe("DiningSessionService", () => {
  let service: DiningSessionService;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;
  let orderRepository: jest.Mocked<OrderRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiningSessionService,
        { provide: DiningSessionRepository, useValue: { findByToken: jest.fn(), update: jest.fn() } },
        { provide: DiningTableRepository, useValue: { findById: jest.fn(), update: jest.fn() } },
        {
          provide: OrderRepository,
          useValue: { findOpenBySessionId: jest.fn(), updateItemStatus: jest.fn(), update: jest.fn() },
        },
        { provide: RestaurantRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get(DiningSessionService);
    diningSessionRepository = module.get(DiningSessionRepository);
    diningTableRepository = module.get(DiningTableRepository);
    orderRepository = module.get(OrderRepository);
    restaurantRepository = module.get(RestaurantRepository);
    auditLogService = module.get(AuditLogService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe("resolveActive", () => {
    it("should return a live session", async () => {
      // Arrange
      const session = {
        id: "session-1",
        tableId: "table-1",
        expiresAt: new Date(Date.now() + 60_000),
        endedAt: null,
      } as any;
      diningSessionRepository.findByToken.mockResolvedValue(session);
      diningTableRepository.findById.mockResolvedValue({ id: "table-1", currentSessionId: session.id } as any);

      // Act
      const result = await service.resolveActive("token");

      // Assert
      expect(result).toBe(session);
    });

    it("should throw UnauthorizedException for an unknown token", async () => {
      // Arrange
      diningSessionRepository.findByToken.mockResolvedValue(null);

      // Act & Assert
      await expect(service.resolveActive("token")).rejects.toThrow(new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.NOT_FOUND));
    });

    it("should throw UnauthorizedException once the session has expired", async () => {
      // Arrange
      diningSessionRepository.findByToken.mockResolvedValue({
        id: "session-1",
        expiresAt: new Date(Date.now() - 1),
        endedAt: null,
      } as any);

      // Act & Assert
      await expect(service.resolveActive("token")).rejects.toThrow(new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED));
    });

    it("should throw UnauthorizedException once the table has been closed out", async () => {
      // Arrange
      diningSessionRepository.findByToken.mockResolvedValue({
        id: "session-1",
        expiresAt: new Date(Date.now() + 60_000),
        endedAt: new Date(),
      } as any);

      // Act & Assert
      await expect(service.resolveActive("token")).rejects.toThrow(new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED));
    });

    it("should reject a live token that is no longer the table's current session", async () => {
      diningSessionRepository.findByToken.mockResolvedValue({
        id: "session-old",
        tableId: "table-1",
        expiresAt: new Date(Date.now() + 60_000),
        endedAt: null,
      } as any);
      diningTableRepository.findById.mockResolvedValue({
        id: "table-1",
        currentSessionId: "session-new",
      } as any);

      await expect(service.resolveActive("token")).rejects.toThrow(new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.EXPIRED));
    });
  });

  describe("endSession", () => {
    const endedSession = { ...session, endedAt: new Date() };

    beforeEach(() => {
      restaurantRepository.findById.mockResolvedValue(restaurant as any);
      diningSessionRepository.update.mockResolvedValue(endedSession as any);
      diningTableRepository.update.mockResolvedValue({ id: "table-1", name: "T1" } as any);
      orderRepository.update.mockImplementation(async (id, data) => ({ id, ...data }) as any);
    });

    it("should drop a line the kitchen never started and serve one already cooking, then complete the order", async () => {
      // Arrange
      const items = [item({ id: "item-1", status: OrderItemStatus.PENDING, unitPrice: 100 }), item({ id: "item-2", status: OrderItemStatus.PREPARING, unitPrice: 200 })];
      orderRepository.findOpenBySessionId.mockResolvedValue([order({ items })]);
      orderRepository.updateItemStatus.mockImplementation(trackingUpdateItemStatus(items));

      // Act
      await service.endSession(session as any, authUser, tx);

      // Assert — the untouched line is dropped, the cooking one is treated as delivered
      expect(orderRepository.updateItemStatus).toHaveBeenCalledWith("item-1", OrderItemStatus.CANCELLED, { tx });
      expect(orderRepository.updateItemStatus).toHaveBeenCalledWith("item-2", OrderItemStatus.SERVED, { tx });
      // The order completes, billed only for what was actually made
      expect(orderRepository.update).toHaveBeenCalledWith(
        "order-1",
        expect.objectContaining({ status: OrderStatus.COMPLETED, subtotal: 200, completedAt: expect.any(Date) }),
        { tx, actorId: authUser.sub }
      );
    });

    it("should cancel an order outright when every line was still untouched", async () => {
      // Arrange
      const items = [item({ id: "item-1", status: OrderItemStatus.PENDING })];
      orderRepository.findOpenBySessionId.mockResolvedValue([order({ acceptedAt: null, items })]);
      orderRepository.updateItemStatus.mockImplementation(trackingUpdateItemStatus(items));

      // Act
      await service.endSession(session as any, authUser, tx);

      // Assert — nothing was ever made, so the ticket itself is cancelled, not completed
      expect(orderRepository.update).toHaveBeenCalledWith(
        "order-1",
        expect.objectContaining({ status: OrderStatus.CANCELLED, cancelledAt: expect.any(Date), completedAt: null, subtotal: 0 }),
        { tx, actorId: authUser.sub }
      );
    });

    it("should leave already-served or already-cancelled lines alone", async () => {
      // Arrange
      const items = [item({ id: "item-1", status: OrderItemStatus.SERVED }), item({ id: "item-2", status: OrderItemStatus.CANCELLED })];
      orderRepository.findOpenBySessionId.mockResolvedValue([order({ items })]);

      // Act
      await service.endSession(session as any, authUser, tx);

      // Assert
      expect(orderRepository.updateItemStatus).not.toHaveBeenCalled();
    });

    it("should end the session, clear the table, and record what closing did", async () => {
      // Arrange
      const completedItems = [item({ id: "item-1", status: OrderItemStatus.READY })];
      const cancelledItems = [item({ id: "item-2", status: OrderItemStatus.PENDING })];
      orderRepository.findOpenBySessionId.mockResolvedValue([
        order({ id: "order-1", items: completedItems }),
        order({ id: "order-2", acceptedAt: null, items: cancelledItems }),
      ]);
      orderRepository.updateItemStatus.mockImplementation(async (itemId, status) => {
        const items = itemId === "item-1" ? completedItems : cancelledItems;
        const index = items.findIndex(candidate => candidate.id === itemId);
        items[index] = { ...items[index], status };
        return { id: itemId === "item-1" ? "order-1" : "order-2", items: [...items] } as any;
      });

      // Act
      const result = await service.endSession(session as any, authUser, tx);

      // Assert
      expect(result).toEqual({ id: "table-1", name: "T1" });
      expect(diningSessionRepository.update).toHaveBeenCalledWith("session-1", { endedAt: expect.any(Date) }, tx);
      expect(diningTableRepository.update).toHaveBeenCalledWith("table-1", { currentSessionId: null }, { tx });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.table_session_ended,
          subject: "T1",
          detail: expect.stringContaining("1 order completed, 1 cancelled"),
        }),
        authUser,
        tx
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith("session.ended", endedSession);
      expect(eventEmitter.emit).toHaveBeenCalledWith("order.updated", expect.objectContaining({ id: "order-1" }));
      expect(eventEmitter.emit).toHaveBeenCalledWith("order.updated", expect.objectContaining({ id: "order-2" }));
    });

    it("should leave the table alone when nothing was open", async () => {
      // Arrange
      orderRepository.findOpenBySessionId.mockResolvedValue([]);

      // Act
      await service.endSession(session as any, authUser, tx);

      // Assert
      expect(restaurantRepository.findById).not.toHaveBeenCalled();
      expect(orderRepository.updateItemStatus).not.toHaveBeenCalled();
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ detail: "Table cleared for the next visit" }),
        authUser,
        tx
      );
    });
  });
});
