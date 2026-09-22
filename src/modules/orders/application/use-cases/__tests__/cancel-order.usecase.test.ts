import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction, OrderItemStatus, OrderStatus } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { CancelOrderUsecase } from "../cancel-order.usecase";

const authUser = buildAuthEntity();
const dto = { reason: "Kitchen ran out of chicken" };

function buildOrder(status: OrderStatus, items: { status: OrderItemStatus }[] = []) {
  return { id: "order-1", reference: "#1001", restaurantId: authUser.restaurantId, status, items } as any;
}

describe("CancelOrderUsecase", () => {
  let usecase: CancelOrderUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelOrderUsecase,
        { provide: OrderRepository, useValue: { findById: jest.fn(), update: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(CancelOrderUsecase);
    orderRepository = module.get(OrderRepository);
    auditLogService = module.get(AuditLogService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe("execute", () => {
    it("should cancel with the reason attached and record it", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder(OrderStatus.PENDING));
      orderRepository.update.mockResolvedValue(buildOrder(OrderStatus.CANCELLED));

      // Act
      const result = await usecase.execute("order-1", dto, authUser);

      // Assert
      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(orderRepository.update).toHaveBeenCalledWith(
        "order-1",
        { status: OrderStatus.CANCELLED, cancelReason: dto.reason, cancelledAt: expect.any(Date) },
        { actorId: authUser.sub }
      );
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.order_cancelled, detail: dto.reason }),
        authUser
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
    });

    it("should throw NotFoundException when the order is unknown", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("order-1", dto, authUser)).rejects.toThrow(new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND));
    });
  });
});
