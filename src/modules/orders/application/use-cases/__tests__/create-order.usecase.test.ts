import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";
import { OrderType } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { PrismaTransaction } from "../../../../../common/prisma";
import { AddOnRepository } from "../../../../add-ons/domain/repositories/add-on.repository";
import { CustomerRepository } from "../../../../customers/domain/repositories/customer.repository";
import { DishVariantRepository } from "../../../../dish-variants/domain/repositories/dish-variant.repository";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { IDiningSession } from "../../../../dining-sessions/domain/interfaces/dining-session.interface";
import { RESTAURANT_ERROR_MESSAGES } from "../../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { CreateOrderUsecase } from "../create-order.usecase";

const session = { id: "session-1", restaurantId: "restaurant-1", tableId: "table-1", customerId: null, floorId: null } as IDiningSession;
const deliverySession = {
  id: "session-2",
  restaurantId: "restaurant-1",
  tableId: null,
  customerId: "customer-1",
  floorId: null,
} as IDiningSession;
const floorSession = {
  id: "session-3",
  restaurantId: "restaurant-1",
  tableId: null,
  customerId: null,
  floorId: "floor-1",
  floorVisitorName: "Cabin A",
} as IDiningSession;
const restaurant = {
  id: "restaurant-1",
  isActive: true,
  currency: "NPR",
  serviceChargeRate: 0.1,
  taxRate: 0.13,
  deliveryFeeAmount: 5000,
} as any;
const customer = {
  id: "customer-1",
  restaurantId: "restaurant-1",
  phone: "9800000000",
  name: "Hari Gurung",
  defaultAddress: "Baneshwor, Kathmandu",
  defaultNote: "Ring the bell twice",
};
const dish = {
  id: "dish-1",
  restaurantId: "restaurant-1",
  name: "Chicken Sekuwa",
  imageUrl: null,
  price: 45000,
  isAvailable: true,
  isArchived: false,
} as any;
const extraSpice = { id: "addon-1", restaurantId: "restaurant-1", name: "Extra Spice", price: 1000, isAvailable: true, isArchived: false };
const large = { id: "variant-1", dishId: "dish-1", name: "Large", price: 50000, isAvailable: true, isArchived: false };

describe("CreateOrderUsecase", () => {
  let usecase: CreateOrderUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let dishRepository: jest.Mocked<DishRepository>;
  let addOnRepository: jest.Mocked<AddOnRepository>;
  let dishVariantRepository: jest.Mocked<DishVariantRepository>;
  let customerRepository: jest.Mocked<CustomerRepository>;
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
        { provide: AddOnRepository, useValue: { findLinkedToDish: jest.fn() } },
        { provide: DishVariantRepository, useValue: { findManyByDishIds: jest.fn() } },
        { provide: CustomerRepository, useValue: { findById: jest.fn(), upsert: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(CreateOrderUsecase);
    orderRepository = module.get(OrderRepository);
    restaurantRepository = module.get(RestaurantRepository);
    dishRepository = module.get(DishRepository);
    addOnRepository = module.get(AddOnRepository);
    dishVariantRepository = module.get(DishVariantRepository);
    customerRepository = module.get(CustomerRepository);
    eventEmitter = module.get(EventEmitter2);
    dishVariantRepository.findManyByDishIds.mockResolvedValue({});
  });

  describe("execute", () => {
    it("should price the order from the dish rows and the restaurant's own fees", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      const result = await usecase.execute({ lines: [{ dishId: "dish-1", quantity: 2, addOnIds: [] }] }, session);

      // Assert
      expect(result.id).toBe("order-1");
      const [created] = orderRepository.create.mock.calls[0];
      expect(created.items[0]).toMatchObject({ unitPrice: 45000, quantity: 2, dishNameSnapshot: "Chicken Sekuwa", addOns: [] });
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

    it("should charge the dish price plus every selected add-on's price", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      addOnRepository.findLinkedToDish.mockResolvedValue([extraSpice] as any);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [extraSpice.id] }] }, session);

      // Assert
      const [created] = orderRepository.create.mock.calls[0];
      expect(created.items[0]).toMatchObject({
        unitPrice: 46000,
        addOns: [{ addOnId: extraSpice.id, nameSnapshot: extraSpice.name, priceSnapshot: extraSpice.price }],
      });
      expect(created.subtotal).toBe(46000);
    });

    it("should price the line from the selected variant instead of the dish price", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      dishVariantRepository.findManyByDishIds.mockResolvedValue({ "dish-1": [large] } as any);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [], variantId: large.id }] }, session);

      // Assert
      const [created] = orderRepository.create.mock.calls[0];
      expect(created.items[0]).toMatchObject({
        unitPrice: large.price,
        variantId: large.id,
        variantNameSnapshot: large.name,
        variantPriceSnapshot: large.price,
      });
      expect(created.subtotal).toBe(large.price);
    });

    it("should throw BadRequestException when the dish has variants but none was chosen", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      dishVariantRepository.findManyByDishIds.mockResolvedValue({ "dish-1": [large] } as any);

      // Act & Assert
      await expect(usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }] }, session)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.VARIANT_REQUIRED)
      );
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when the chosen variant doesn't belong to the dish", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      dishVariantRepository.findManyByDishIds.mockResolvedValue({});

      // Act & Assert
      await expect(
        usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [], variantId: large.id }] }, session)
      ).rejects.toThrow(new BadRequestException(ORDER_ERROR_MESSAGES.VARIANT_UNAVAILABLE));
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an add-on that isn't linked to the dish", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      addOnRepository.findLinkedToDish.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [extraSpice.id] }] }, session)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.ADD_ON_UNAVAILABLE)
      );
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("should reject an add-on that's currently unavailable", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      addOnRepository.findLinkedToDish.mockResolvedValue([{ ...extraSpice, isAvailable: false }] as any);

      // Act & Assert
      await expect(usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [extraSpice.id] }] }, session)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.ADD_ON_UNAVAILABLE)
      );
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("should return the first order when the same idempotency key is retried", async () => {
      // Arrange
      const placed = { id: "order-1" } as any;
      orderRepository.findByIdempotencyKey.mockResolvedValue(placed);

      // Act
      const result = await usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }] }, session, {
        idempotencyKey: "retry-key",
      });

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
      await expect(usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }] }, session)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.DISH_UNAVAILABLE)
      );
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException for a dish belonging to another restaurant", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([{ ...dish, restaurantId: "restaurant-9" }]);

      // Act & Assert
      await expect(usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }] }, session)).rejects.toThrow(
        new NotFoundException(ORDER_ERROR_MESSAGES.DISH_NOT_FOUND)
      );
    });

    it("should throw NotFoundException when the restaurant has been deactivated mid-session", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue({ ...restaurant, isActive: false });

      // Act & Assert
      await expect(usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }] }, session)).rejects.toThrow(
        new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND)
      );
    });

    it("should place a DELIVERY order with a null tableId, the restaurant's delivery fee, and the customer's own details", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      customerRepository.findById.mockResolvedValue(customer as any);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }] }, deliverySession);

      // Assert
      const [created] = orderRepository.create.mock.calls[0];
      expect(created).toMatchObject({
        tableId: null,
        orderType: OrderType.DELIVERY,
        customerId: customer.id,
        deliveryFee: 5000,
        deliveryPhone: customer.phone,
        deliveryCustomerName: customer.name,
        deliveryAddress: customer.defaultAddress,
        deliveryNote: customer.defaultNote,
        total: 45000 + 4500 + 6435 + 5000,
      });
    });

    it("should let a delivery order override the customer's default address/note per order", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      customerRepository.findById.mockResolvedValue(customer as any);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute(
        {
          lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }],
          deliveryAddress: "Office, Durbarmarg",
          deliveryNote: "Leave at reception",
        },
        deliverySession
      );

      // Assert
      const [created] = orderRepository.create.mock.calls[0];
      expect(created).toMatchObject({ deliveryAddress: "Office, Durbarmarg", deliveryNote: "Leave at reception" });
    });

    it("should not charge a delivery fee for a dine-in order even when the restaurant has one configured", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }] }, session);

      // Assert
      const [created] = orderRepository.create.mock.calls[0];
      expect(created).toMatchObject({ orderType: OrderType.DINE_IN, deliveryFee: 0 });
      expect(created.deliveryAddress).toBeUndefined();
      expect(customerRepository.findById).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when a delivery session's customer record is missing", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      customerRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }] }, deliverySession)).rejects.toThrow(
        new NotFoundException(ORDER_ERROR_MESSAGES.CUSTOMER_NOT_FOUND)
      );
      expect(orderRepository.create).not.toHaveBeenCalled();
    });

    it("should place a floor-session order as DINE_IN, falling back to the session's legacy floor name when none is sent", async () => {
      // Arrange — regression test: a floor session also has a null `tableId`, same as a delivery
      // session, so this proves the `orderType` check no longer keys off `tableId`.
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }] }, floorSession);

      // Assert
      const [created] = orderRepository.create.mock.calls[0];
      expect(created).toMatchObject({ orderType: OrderType.DINE_IN, tableId: null, deliveryFee: 0, floorVisitorName: "Cabin A" });
      expect(customerRepository.findById).not.toHaveBeenCalled();
    });

    it("should snapshot the request's own floorVisitorName (where to bring the order) onto a floor order, overriding the session's legacy one", async () => {
      // Arrange — §16b: the cabin/room/spot is now captured at order time, not session start.
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }], floorVisitorName: "Room 12" }, floorSession);

      // Assert
      const [created] = orderRepository.create.mock.calls[0];
      expect(created).toMatchObject({ orderType: OrderType.DINE_IN, floorVisitorName: "Room 12" });
    });

    it("should upsert a Customer by phone and attach it to a floor order given identity in the request, independently of floorVisitorName", async () => {
      // Arrange — §16b: identity (who it's for) and floorVisitorName (where it goes) are
      // independent — the customer's own name must never leak onto floorVisitorName.
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      customerRepository.upsert.mockResolvedValue(customer as any);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute(
        {
          lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }],
          customer: { phone: "9800000000", name: "Hari Gurung" },
          floorVisitorName: "Cabin B",
        },
        floorSession
      );

      // Assert
      expect(customerRepository.upsert).toHaveBeenCalledWith(
        { restaurantId: "restaurant-1", phone: "9800000000", name: "Hari Gurung" },
        { tx: expect.anything() }
      );
      const [created] = orderRepository.create.mock.calls[0];
      expect(created).toMatchObject({ orderType: OrderType.DINE_IN, customerId: customer.id, floorVisitorName: "Cabin B" });
    });

    it("should upsert a Customer by phone and attach it to a table order given identity in the request", async () => {
      // Arrange — §16b extended to tables: a table order has no floorVisitorName to keep
      // independent of identity, but the customer capture itself works the same way.
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      customerRepository.upsert.mockResolvedValue(customer as any);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute(
        {
          lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }],
          customer: { phone: "9800000000", name: "Hari Gurung" },
        },
        session
      );

      // Assert
      expect(customerRepository.upsert).toHaveBeenCalledWith(
        { restaurantId: "restaurant-1", phone: "9800000000", name: "Hari Gurung" },
        { tx: expect.anything() }
      );
      const [created] = orderRepository.create.mock.calls[0];
      expect(created).toMatchObject({ orderType: OrderType.DINE_IN, customerId: customer.id, floorVisitorName: null });
    });

    it("should ignore a customer payload sent for a delivery order — identity always comes from the session", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      customerRepository.findById.mockResolvedValue(customer as any);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute(
        { lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }], customer: { phone: "9811111111", name: "Someone Else" } },
        deliverySession
      );

      // Assert
      expect(customerRepository.upsert).not.toHaveBeenCalled();
      const [created] = orderRepository.create.mock.calls[0];
      expect(created.customerId).toBe(customer.id);
    });

    it("should leave floorVisitorName null for a table or delivery order", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(restaurant);
      dishRepository.findManyByIds.mockResolvedValue([dish]);
      orderRepository.create.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute({ lines: [{ dishId: "dish-1", quantity: 1, addOnIds: [] }] }, session);

      // Assert
      const [created] = orderRepository.create.mock.calls[0];
      expect(created.floorVisitorName).toBeNull();
    });
  });
});
