import { Test, TestingModule } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AuditAction, OrderStatus, OrderType } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { SettleDeliveryOrderUsecase } from "../settle-delivery-order.usecase";

const authUser = buildAuthEntity();

function buildOrder(status: OrderStatus, orderType: OrderType = OrderType.DELIVERY) {
  return {
    id: "order-1",
    reference: "#1001",
    restaurantId: authUser.restaurantId,
    status,
    orderType,
    total: 60935,
    currency: "NPR",
  } as any;
}

describe("SettleDeliveryOrderUsecase", () => {
  let usecase: SettleDeliveryOrderUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettleDeliveryOrderUsecase,
        {
          provide: OrderRepository,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
            $transaction: jest.fn(fn => fn(undefined)),
            markReadyItemsServed: jest.fn(),
          },
        },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(SettleDeliveryOrderUsecase);
    orderRepository = module.get(OrderRepository);
    auditLogService = module.get(AuditLogService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe("execute", () => {
    it("should settle an out-for-delivery order to COMPLETED, serve every ready item and record it", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder(OrderStatus.OUT_FOR_DELIVERY));
      orderRepository.update.mockResolvedValue(buildOrder(OrderStatus.COMPLETED));

      // Act
      const result = await usecase.execute("order-1", authUser);

      // Assert
      expect(result.status).toBe(OrderStatus.COMPLETED);
      expect(orderRepository.markReadyItemsServed).toHaveBeenCalledWith("order-1", { tx: undefined });
      const [, patch] = orderRepository.update.mock.calls[0];
      expect(patch.completedAt).toBeInstanceOf(Date);
      expect(auditLogService.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.order_status_changed }), authUser);
      expect(eventEmitter.emit).toHaveBeenCalledWith("order.updated", result);
    });

    it("should throw NotFoundException for another restaurant's order", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue({ ...buildOrder(OrderStatus.OUT_FOR_DELIVERY), restaurantId: "other" });

      // Act & Assert
      await expect(usecase.execute("order-1", authUser)).rejects.toThrow(new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND));
    });

    it("should refuse a dine-in order", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder(OrderStatus.READY, OrderType.DINE_IN));

      // Act & Assert
      await expect(usecase.execute("order-1", authUser)).rejects.toThrow(new BadRequestException(ORDER_ERROR_MESSAGES.NOT_DELIVERY_ORDER));
      expect(orderRepository.update).not.toHaveBeenCalled();
    });

    it("should refuse settling a delivery order that hasn't been dispatched yet", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(buildOrder(OrderStatus.READY));

      // Act & Assert
      await expect(usecase.execute("order-1", authUser)).rejects.toThrow(new BadRequestException(ORDER_ERROR_MESSAGES.INVALID_TRANSITION));
      expect(orderRepository.update).not.toHaveBeenCalled();
    });
  });
});
