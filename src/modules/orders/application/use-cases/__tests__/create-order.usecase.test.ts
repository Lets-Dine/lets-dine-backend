import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { PrismaTransaction } from "../../../../../common/prisma";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { IDiningSession } from "../../../../dining-sessions/domain/interfaces/dining-session.interface";
import { RESTAURANT_ERROR_MESSAGES } from "../../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { CreateOrderUsecase } from "../create-order.usecase";

const session = { id: "session-1", restaurantId: "restaurant-1", tableId: "table-1" } as IDiningSession;
const restaurant = {
  id: "restaurant-1",
  isActive: true,
  currency: "NPR",
  serviceChargeRate: 0.1,
  taxRate: 0.13,
} as any;
const dish = {
  id: "dish-1",
  restaurantId: "restaurant-1",
  name: "Chicken Sekuwa",
  imageUrl: null,
  price: 45000,
  isAvailable: true,
  isArchived: false,
} as any;

describe("CreateOrderUsecase", () => {
  let usecase: CreateOrderUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let dishRepository: jest.Mocked<DishRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateOrderUsecase,
        {
          provide: OrderRepository,
          useValue: {
            $transaction: jest.fn((fn: (tx: PrismaTransaction) => Promise<unknown>) => fn({} as PrismaTransaction)),
            findByIdempotencyKey: jest.fn(),
            create: jest.fn(),
          },
        },
        { provide: RestaurantRepository, useValue: { findById: jest.fn() } },
        { provide: DishRepository, useValue: { findManyByIds: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(CreateOrderUsecase);
    orderRepository = module.get(OrderRepository);
    restaurantRepository = module.get(RestaurantRepository);
    dishRepository = module.get(DishRepository);
    eventEmitter = module.get(EventEmitter2);
  });

  describe("execute", () => {
    it("should price the order from the dish rows and the restaurant's own fees", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      const result = await usecase.execute({ lines: [{ dishId: "dish-1", quantity: 2 }] }, session);

      // Assert
      expect(result.id).toBe("order-1");
      const [created] = orderRepository.create.mock.calls[0];
      expect(created.items[0]).toMatchObject({ unitPrice: 45000, quantity: 2, dishNameSnapshot: "Chicken Sekuwa" });
      expect(created).toMatchObject({
        subtotal: 90000,
        serviceCharge: 9000,
        tax: 12870,
        total: 111870,
        currency: "NPR",
        tableId: session.tableId,
        sessionId: session.id,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith("order.created", { id: "order-1" });
    });

    it("should return the first order when the same idempotency key is retried", async () => {
      // Arrange
      const placed = { id: "order-1" } as any;
      orderRepository.findByIdempotencyKey.mockResolvedValue(placed);

      // Act
      const result = await usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1 }] }, session, { idempotencyKey: "retry-key" });

      // Assert
      expect(result).toBe(placed);
      expect(orderRepository.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when a dish has just gone unavailable", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([{ ...dish, isAvailable: false }]);

      // Act & Assert
      await expect(usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1 }] }, session)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.DISH_UNAVAILABLE)
      );
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException for a dish belonging to another restaurant", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([{ ...dish, restaurantId: "restaurant-9" }]);

      // Act & Assert
      await expect(usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1 }] }, session)).rejects.toThrow(
        new NotFoundException(ORDER_ERROR_MESSAGES.DISH_NOT_FOUND)
      );
    });

    it("should throw NotFoundException when the restaurant has been deactivated mid-session", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue({ ...restaurant, isActive: false });

      // Act & Assert
      await expect(usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1 }] }, session)).rejects.toThrow(
        new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND)
      );
    });
  });
});
