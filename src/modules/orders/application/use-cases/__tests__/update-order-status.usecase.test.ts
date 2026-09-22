import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction, OrderStatus } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { UpdateOrderStatusUsecase } from "../update-order-status.usecase";

const authUser = buildAuthEntity();

function buildOrder(status: OrderStatus) {
  return {
    id: "order-1",
    reference: "#1001",
    restaurantId: authUser.restaurantId,
    status,
    completedAt: null,
  } as any;
}

describe("UpdateOrderStatusUsecase", () => {
  let usecase: UpdateOrderStatusUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateOrderStatusUsecase,
        { provide: OrderRepository, useValue: { findById: jest.fn(), update: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(UpdateOrderStatusUsecase);
    orderRepository = module.get(OrderRepository);
    auditLogService = module.get(AuditLogService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe("execute", () => {
    it("should advance the ticket and record the move", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder(OrderStatus.PENDING));
      orderRepository.update.mockResolvedValue(buildOrder(OrderStatus.ACCEPTED));

      // Act
      const result = await usecase.execute("order-1", { status: OrderStatus.ACCEPTED }, authUser);

      // Assert
      expect(result.status).toBe(OrderStatus.ACCEPTED);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.order_status_changed, detail: "PENDING → ACCEPTED" }),
        authUser
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith("order.updated", result);
    });

    it("should stamp acceptedAt when the ticket is accepted", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder(OrderStatus.PENDING));
      orderRepository.update.mockResolvedValue(buildOrder(OrderStatus.ACCEPTED));

      // Act
      await usecase.execute("order-1", { status: OrderStatus.ACCEPTED }, authUser);

      // Assert
      const [, patch] = orderRepository.update.mock.calls[0];
      expect(patch.acceptedAt).toBeInstanceOf(Date);
    });

    it("should refuse any target other than ACCEPTED — status past that point follows its items", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder(OrderStatus.PREPARING));

      // Act & Assert
      await expect(usecase.execute("order-1", { status: OrderStatus.READY }, authUser)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.STATUS_FOLLOWS_ITEMS)
      );
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it("should still refuse skipping straight to ACCEPTED from a non-PENDING order", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder(OrderStatus.ACCEPTED));

      // Act & Assert
      await expect(usecase.execute("order-1", { status: OrderStatus.ACCEPTED }, authUser)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.INVALID_TRANSITION)
      );
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException for another restaurant's order", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue({ ...buildOrder(OrderStatus.PENDING), restaurantId: "other" });

      // Act & Assert
      await expect(usecase.execute("order-1", { status: OrderStatus.ACCEPTED }, authUser)).rejects.toThrow(
        new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND)
      );
    });
  });
});
