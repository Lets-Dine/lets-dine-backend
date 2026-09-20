import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { DiningTableRepository } from "../../../../tables/domain/repositories/dining-table.repository";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { AddOrderItemUsecase } from "../add-order-item.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const restaurant = { id: authUser.restaurantId, serviceChargeRate: 0.1, taxRate: 0.13, currency: "NPR" };
const table = { id: "table-1", restaurantId: authUser.restaurantId, name: "Table 1" };

describe("AddOrderItemUsecase", () => {
  let usecase: AddOrderItemUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;
  let dishRepository: jest.Mocked<DishRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddOrderItemUsecase,
        {
          provide: OrderRepository,
          useValue: { $transaction: jest.fn(fn => fn(tx)), findLatestByTableId: jest.fn(), replaceItems: jest.fn() },
        },
        { provide: DiningTableRepository, useValue: { findById: jest.fn() } },
        { provide: DishRepository, useValue: { findById: jest.fn() } },
        { provide: RestaurantRepository, useValue: { findById: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(AddOrderItemUsecase);
    orderRepository = module.get(OrderRepository);
    diningTableRepository = module.get(DiningTableRepository);
    dishRepository = module.get(DishRepository);
    restaurantRepository = module.get(RestaurantRepository);
    auditLogService = module.get(AuditLogService);

    diningTableRepository.findById.mockResolvedValue(table as any);
    restaurantRepository.findById.mockResolvedValue(restaurant as any);
  });

  describe("execute", () => {
    it("should append a new line when the dish isn't already on the order", async () => {
      // Arrange
      const order = { id: "order-1", reference: "#1001", items: [] };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      dishRepository.findById.mockResolvedValue({ id: "dish-1", restaurantId: authUser.restaurantId, name: "Momo", imageUrl: null, price: 200 } as any);
      orderRepository.replaceItems.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1" }, authUser);

      // Assert
      const [, items, totals] = orderRepository.replaceItems.mock.calls[0];
      expect(items).toEqual([{ dishId: "dish-1", dishNameSnapshot: "Momo", imageUrlSnapshot: null, unitPrice: 200, quantity: 1, notes: "" }]);
      expect(totals.subtotal).toBe(200);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.order_item_added, subject: "Order #1001" }),
        authUser,
        tx
      );
    });

    it("should increment the existing line instead of duplicating it", async () => {
      // Arrange
      const order = {
        id: "order-1",
        reference: "#1001",
        items: [{ dishId: "dish-1", dishNameSnapshot: "Momo", imageUrlSnapshot: null, unitPrice: 200, quantity: 1, notes: "" }],
      };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      dishRepository.findById.mockResolvedValue({ id: "dish-1", restaurantId: authUser.restaurantId, name: "Momo", imageUrl: null, price: 200 } as any);
      orderRepository.replaceItems.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1" }, authUser);

      // Assert
      const [, items] = orderRepository.replaceItems.mock.calls[0];
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(2);
    });

    it("should throw NotFoundException when the table isn't this restaurant's", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("table-1", { dishId: "dish-1" }, authUser)).rejects.toThrow(
        new NotFoundException(ORDER_ERROR_MESSAGES.TABLE_NOT_FOUND)
      );
    });

    it("should throw NotFoundException when the table has no order to add to", async () => {
      // Arrange
      orderRepository.findLatestByTableId.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("table-1", { dishId: "dish-1" }, authUser)).rejects.toThrow(
        new NotFoundException(ORDER_ERROR_MESSAGES.NO_ORDER_FOR_TABLE)
      );
    });

    it("should throw NotFoundException when the dish isn't on this restaurant's menu", async () => {
      // Arrange
      orderRepository.findLatestByTableId.mockResolvedValue({ id: "order-1", reference: "#1001", items: [] } as any);
      dishRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("table-1", { dishId: "dish-1" }, authUser)).rejects.toThrow(NotFoundException);
    });
  });
});
