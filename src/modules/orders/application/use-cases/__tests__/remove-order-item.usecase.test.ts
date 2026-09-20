import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { RemoveOrderItemUsecase } from "../remove-order-item.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const restaurant = { id: authUser.restaurantId, serviceChargeRate: 0.1, taxRate: 0.13, currency: "NPR" };

describe("RemoveOrderItemUsecase", () => {
  let usecase: RemoveOrderItemUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoveOrderItemUsecase,
        { provide: OrderRepository, useValue: { $transaction: jest.fn(fn => fn(tx)), findById: jest.fn(), replaceItems: jest.fn() } },
        { provide: RestaurantRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(RemoveOrderItemUsecase);
    orderRepository = module.get(OrderRepository);
    restaurantRepository = module.get(RestaurantRepository);
    auditLogService = module.get(AuditLogService);

    restaurantRepository.findById.mockResolvedValue(restaurant as any);
  });

  describe("execute", () => {
    it("should decrement a line with more than one unit", async () => {
      // Arrange
      const order = {
        id: "order-1",
        reference: "#1001",
        restaurantId: authUser.restaurantId,
        items: [{ id: "item-1", dishId: "dish-1", dishNameSnapshot: "Momo", imageUrlSnapshot: null, unitPrice: 200, quantity: 2, notes: "" }],
      };
      orderRepository.findById.mockResolvedValue(order as any);
      orderRepository.replaceItems.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute("order-1", "item-1", authUser);

      // Assert
      const [, items] = orderRepository.replaceItems.mock.calls[0];
      expect(items).toEqual([{ dishId: "dish-1", dishNameSnapshot: "Momo", imageUrlSnapshot: null, unitPrice: 200, quantity: 1, notes: "" }]);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.order_item_removed, subject: "Order #1001" }),
        authUser,
        tx
      );
    });

    it("should drop a line entirely when its last unit is removed", async () => {
      // Arrange
      const order = {
        id: "order-1",
        reference: "#1001",
        restaurantId: authUser.restaurantId,
        items: [{ id: "item-1", dishId: "dish-1", dishNameSnapshot: "Momo", imageUrlSnapshot: null, unitPrice: 200, quantity: 1, notes: "" }],
      };
      orderRepository.findById.mockResolvedValue(order as any);
      orderRepository.replaceItems.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute("order-1", "item-1", authUser);

      // Assert
      const [, items] = orderRepository.replaceItems.mock.calls[0];
      expect(items).toEqual([]);
    });

    it("should allow removing an item from an order that's already completed", async () => {
      // Arrange
      const order = {
        id: "order-1",
        reference: "#1001",
        restaurantId: authUser.restaurantId,
        status: "COMPLETED",
        items: [{ id: "item-1", dishId: "dish-1", dishNameSnapshot: "Momo", imageUrlSnapshot: null, unitPrice: 200, quantity: 1, notes: "" }],
      };
      orderRepository.findById.mockResolvedValue(order as any);
      orderRepository.replaceItems.mockResolvedValue({ id: "order-1" } as any);

      // Act & Assert
      await expect(usecase.execute("order-1", "item-1", authUser)).resolves.toBeDefined();
    });

    it("should throw NotFoundException when the order isn't this restaurant's", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("order-1", "item-1", authUser)).rejects.toThrow(new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND));
    });

    it("should throw NotFoundException when the item is no longer on the order", async () => {
      // Arrange
      orderRepository.findById.mockResolvedValue({ id: "order-1", restaurantId: authUser.restaurantId, items: [] } as any);

      // Act & Assert
      await expect(usecase.execute("order-1", "item-1", authUser)).rejects.toThrow(
        new NotFoundException(ORDER_ERROR_MESSAGES.ITEM_NOT_FOUND)
      );
    });
  });
});
