import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction, OrderItemStatus, OrderStatus } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { CancelOrderUsecase } from "../cancel-order.usecase";

const authUser = buildAuthEntity();
const dto = { reason: "Kitchen ran out of chicken" };
const tx = {} as any;
const restaurant = { id: authUser.restaurantId, serviceChargeRate: 0.1, taxRate: 0.13, currency: "NPR" };

function buildOrder(status: OrderStatus, items: { id?: string; unitPrice?: number; quantity?: number; status: OrderItemStatus }[] = []) {
  return {
    id: "order-1",
    reference: "#1001",
    restaurantId: authUser.restaurantId,
    branchId: authUser.branchId,
    status,
    discount: 0,
    items,
  } as any;
}

describe("CancelOrderUsecase", () => {
  let usecase: CancelOrderUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelOrderUsecase,
        {
          provide: OrderRepository,
          useValue: {
            $transaction: jest.fn(fn => fn(tx)),
            findById: jest.fn(),
            update: jest.fn(),
            updateItemStatus: jest.fn(),
          },
        },
        { provide: RestaurantRepository, useValue: { findByIdForBranch: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(CancelOrderUsecase);
    orderRepository = module.get(OrderRepository);
    restaurantRepository = module.get(RestaurantRepository);
    auditLogService = module.get(AuditLogService);
    eventEmitter = module.get(EventEmitter2);

    restaurantRepository.findByIdForBranch.mockResolvedValue(restaurant as any);
  });

  describe("execute", () => {
    it("should cancel every not-yet-served item along with the order, and zero the bill", async () => {
      // Arrange
      const items: { id: string; unitPrice: number; quantity: number; status: OrderItemStatus }[] = [
        { id: "item-1", unitPrice: 200, quantity: 1, status: OrderItemStatus.PENDING },
        { id: "item-2", unitPrice: 300, quantity: 2, status: OrderItemStatus.PENDING },
      ];
      orderRepository.findById.mockResolvedValue(buildOrder(OrderStatus.PENDING, items));
      // A stateful stand-in for the row the real repository would return — each call must see the
      // previous call's write, or a two-item cancel would look like it kept reverting the first line.
      const tracked = items.map(item => ({ ...item }));
      orderRepository.updateItemStatus.mockImplementation(async (itemId: string, status: OrderItemStatus) => {
        const item = tracked.find(candidate => candidate.id === itemId);
        if (item) item.status = status;
        return { items: tracked.map(candidate => ({ ...candidate })) } as any;
      });
      orderRepository.update.mockResolvedValue(buildOrder(OrderStatus.CANCELLED));

      // Act
      const result = await usecase.execute("order-1", dto, authUser);

      // Assert — both still-pending lines were voided, not just the order itself.
      expect(orderRepository.updateItemStatus).toHaveBeenCalledWith("item-1", OrderItemStatus.CANCELLED, { tx });
      expect(orderRepository.updateItemStatus).toHaveBeenCalledWith("item-2", OrderItemStatus.CANCELLED, { tx });
      expect(orderRepository.update).toHaveBeenCalledWith(
        "order-1",
        expect.objectContaining({
          status: OrderStatus.CANCELLED,
          cancelReason: dto.reason,
          cancelledAt: expect.any(Date),
          subtotal: 0,
          total: 0,
        }),
        { tx, actorId: authUser.sub }
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.order_cancelled, detail: dto.reason }),
        authUser,
        tx
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith("order.updated", result);
    });

    it("should throw ConflictException when it is already cancelled", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder(OrderStatus.CANCELLED));

      // Act & Assert
      await expect(usecase.execute("order-1", dto, authUser)).rejects.toThrow(
        new ConflictException(ORDER_ERROR_MESSAGES.ALREADY_CANCELLED)
      );
      expect(orderRepository.updateItemStatus).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException once the food is ready", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder(OrderStatus.READY));

      // Act & Assert
      await expect(usecase.execute("order-1", dto, authUser)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.NOT_CANCELLABLE)
      );
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException once any single item has started, even though the order itself is still PREPARING", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(
        buildOrder(OrderStatus.PREPARING, [{ status: OrderItemStatus.PENDING }, { status: OrderItemStatus.PREPARING }])
      );

      // Act & Assert
      await expect(usecase.execute("order-1", dto, authUser)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.NOT_CANCELLABLE)
      );
      expect(orderRepository.update).not.toHaveBeenCalled();
      expect(orderRepository.updateItemStatus).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the order is unknown", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("order-1", dto, authUser)).rejects.toThrow(new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND));
    });
  });
});
