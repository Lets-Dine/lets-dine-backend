import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction, OrderItemStatus, OrderStatus } from "@prisma/client";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AddOnRepository } from "../../../../add-ons/domain/repositories/add-on.repository";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DishVariantRepository } from "../../../../dish-variants/domain/repositories/dish-variant.repository";
import { DiningSessionRepository } from "../../../../dining-sessions/domain/repositories/dining-session.repository";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { DiningTableRepository } from "../../../../tables/domain/repositories/dining-table.repository";
import { ORDER_ERROR_MESSAGES } from "../../../domain/constants";
import { OrderRepository } from "../../../domain/repositories/order.repository";
import { AddOrderItemUsecase } from "../add-order-item.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const restaurant = { id: authUser.restaurantId, serviceChargeRate: 0.1, taxRate: 0.13, currency: "NPR" };
const table = { id: "table-1", restaurantId: authUser.restaurantId, branchId: authUser.branchId, name: "Table 1" };
const openSession = { id: "session-1", tableId: "table-1", restaurantId: authUser.restaurantId, branchId: authUser.branchId };
const cheese = {
  id: "addon-1",
  restaurantId: authUser.restaurantId,
  branchId: authUser.branchId,
  name: "Extra Cheese",
  price: 50,
  isAvailable: true,
  isArchived: false,
};
const large = { id: "variant-1", dishId: "dish-1", name: "Large", price: 350, isAvailable: true, isArchived: false };

describe("AddOrderItemUsecase", () => {
  let usecase: AddOrderItemUsecase;
  let orderRepository: jest.Mocked<OrderRepository>;
  let diningTableRepository: jest.Mocked<DiningTableRepository>;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;
  let dishRepository: jest.Mocked<DishRepository>;
  let addOnRepository: jest.Mocked<AddOnRepository>;
  let dishVariantRepository: jest.Mocked<DishVariantRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddOrderItemUsecase,
        {
          provide: OrderRepository,
          useValue: { $transaction: jest.fn(fn => fn(tx)), findLatestByTableId: jest.fn(), syncItems: jest.fn(), create: jest.fn() },
        },
        { provide: DiningTableRepository, useValue: { findById: jest.fn() } },
        { provide: DiningSessionRepository, useValue: { findOpenByTableId: jest.fn() } },
        { provide: DishRepository, useValue: { findById: jest.fn() } },
        { provide: AddOnRepository, useValue: { findLinkedToDish: jest.fn() } },
        { provide: DishVariantRepository, useValue: { findByDishId: jest.fn() } },
        { provide: RestaurantRepository, useValue: { findByIdForBranch: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(AddOrderItemUsecase);
    orderRepository = module.get(OrderRepository);
    diningTableRepository = module.get(DiningTableRepository);
    diningSessionRepository = module.get(DiningSessionRepository);
    dishRepository = module.get(DishRepository);
    addOnRepository = module.get(AddOnRepository);
    dishVariantRepository = module.get(DishVariantRepository);
    restaurantRepository = module.get(RestaurantRepository);
    auditLogService = module.get(AuditLogService);

    diningTableRepository.findById.mockResolvedValue(table as any);
    restaurantRepository.findByIdForBranch.mockResolvedValue(restaurant as any);
    diningSessionRepository.findOpenByTableId.mockResolvedValue(openSession as any);
    dishRepository.findById.mockResolvedValue({
      id: "dish-1",
      restaurantId: authUser.restaurantId,
      branchId: authUser.branchId,
      name: "Momo",
      imageUrl: null,
      price: 200,
    } as any);
    dishVariantRepository.findByDishId.mockResolvedValue([]);
  });

  describe("execute", () => {
    it("should append a new line when the dish isn't already on the order", async () => {
      // Arrange
      const order = { id: "order-1", reference: "#1001", sessionId: openSession.id, status: OrderStatus.PENDING, items: [] };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      orderRepository.syncItems.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1", addOnIds: [] }, authUser);

      // Assert
      const [, changes, totals] = orderRepository.syncItems.mock.calls[0];
      expect(changes).toEqual({
        create: [
          {
            dishId: "dish-1",
            dishNameSnapshot: "Momo",
            imageUrlSnapshot: null,
            unitPrice: 200,
            quantity: 1,
            notes: "",
            variantId: null,
            variantNameSnapshot: null,
            variantPriceSnapshot: null,
            addOns: [],
          },
        ],
        updateQuantity: [],
        deleteIds: [],
      });
      expect(totals.subtotal).toBe(200);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.order_item_added, subject: "Order #1001" }),
        authUser,
        tx
      );
    });

    it("should price the line from the dish plus every selected add-on", async () => {
      // Arrange
      const order = { id: "order-1", reference: "#1001", sessionId: openSession.id, status: OrderStatus.PENDING, items: [] };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      orderRepository.syncItems.mockResolvedValue({ id: "order-1" } as any);
      addOnRepository.findLinkedToDish.mockResolvedValue([cheese] as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1", addOnIds: [cheese.id] }, authUser);

      // Assert
      const [, changes, totals] = orderRepository.syncItems.mock.calls[0];
      expect(changes.create).toEqual([
        {
          dishId: "dish-1",
          dishNameSnapshot: "Momo",
          imageUrlSnapshot: null,
          unitPrice: 250,
          quantity: 1,
          notes: "",
          variantId: null,
          variantNameSnapshot: null,
          variantPriceSnapshot: null,
          addOns: [{ addOnId: cheese.id, nameSnapshot: cheese.name, priceSnapshot: cheese.price }],
        },
      ]);
      expect(totals.subtotal).toBe(250);
    });

    it("should reject an add-on that isn't linked to the dish", async () => {
      // Arrange
      const order = { id: "order-1", reference: "#1001", sessionId: openSession.id, status: OrderStatus.PENDING, items: [] };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      addOnRepository.findLinkedToDish.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute("table-1", { dishId: "dish-1", addOnIds: [cheese.id] }, authUser)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.ADD_ON_UNAVAILABLE)
      );
      expect(orderRepository.syncItems).not.toHaveBeenCalled();
    });

    it("should increment the existing line instead of duplicating it, while it's still PENDING", async () => {
      // Arrange
      const order = {
        id: "order-1",
        reference: "#1001",
        sessionId: openSession.id,
        status: OrderStatus.PENDING,
        items: [
          {
            id: "item-1",
            dishId: "dish-1",
            dishNameSnapshot: "Momo",
            imageUrlSnapshot: null,
            unitPrice: 200,
            quantity: 1,
            notes: "",
            status: OrderItemStatus.PENDING,
            variantId: null,
            addOns: [],
          },
        ],
      };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      orderRepository.syncItems.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1", addOnIds: [] }, authUser);

      // Assert
      const [, changes] = orderRepository.syncItems.mock.calls[0];
      expect(changes).toEqual({ create: [], updateQuantity: [{ id: "item-1", quantity: 2 }], deleteIds: [] });
    });

    it("should start a fresh line rather than merging when the add-on selection differs", async () => {
      // Arrange — same dish already on the order plain, but this repeat wants cheese added.
      const order = {
        id: "order-1",
        reference: "#1001",
        sessionId: openSession.id,
        status: OrderStatus.PENDING,
        items: [
          {
            id: "item-1",
            dishId: "dish-1",
            dishNameSnapshot: "Momo",
            imageUrlSnapshot: null,
            unitPrice: 200,
            quantity: 1,
            notes: "",
            status: OrderItemStatus.PENDING,
            variantId: null,
            addOns: [],
          },
        ],
      };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      orderRepository.syncItems.mockResolvedValue({ id: "order-1" } as any);
      addOnRepository.findLinkedToDish.mockResolvedValue([cheese] as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1", addOnIds: [cheese.id] }, authUser);

      // Assert — a fresh line, the plain one untouched.
      const [, changes] = orderRepository.syncItems.mock.calls[0];
      expect(changes.updateQuantity).toEqual([]);
      expect(changes.create).toHaveLength(1);
      expect(changes.create[0]).toMatchObject({ dishId: "dish-1", unitPrice: 250 });
    });

    it("should append a fresh line instead of merging once the existing line has started cooking", async () => {
      // Arrange
      const order = {
        id: "order-1",
        reference: "#1001",
        sessionId: openSession.id,
        status: OrderStatus.PREPARING,
        items: [
          {
            id: "item-1",
            dishId: "dish-1",
            dishNameSnapshot: "Momo",
            imageUrlSnapshot: null,
            unitPrice: 200,
            quantity: 1,
            notes: "",
            status: OrderItemStatus.PREPARING,
            variantId: null,
            addOns: [],
          },
        ],
      };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      orderRepository.syncItems.mockResolvedValue({ id: "order-1" } as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1", addOnIds: [] }, authUser);

      // Assert
      const [, changes] = orderRepository.syncItems.mock.calls[0];
      expect(changes.updateQuantity).toEqual([]);
      expect(changes.create).toEqual([
        {
          dishId: "dish-1",
          dishNameSnapshot: "Momo",
          imageUrlSnapshot: null,
          unitPrice: 200,
          quantity: 1,
          notes: "",
          variantId: null,
          variantNameSnapshot: null,
          variantPriceSnapshot: null,
          addOns: [],
        },
      ]);
    });

    it("should start a fresh line rather than merging when the variant differs from the existing PENDING line", async () => {
      // Arrange — same dish, same (empty) add-on set already on the order as "Large", this
      // repeat order asks for "Small" instead — must not silently merge into the Large line.
      const small = { ...large, id: "variant-2", name: "Small", price: 250 };
      const order = {
        id: "order-1",
        reference: "#1001",
        sessionId: openSession.id,
        status: OrderStatus.PENDING,
        items: [
          {
            id: "item-1",
            dishId: "dish-1",
            dishNameSnapshot: "Momo",
            imageUrlSnapshot: null,
            unitPrice: large.price,
            quantity: 1,
            notes: "",
            status: OrderItemStatus.PENDING,
            variantId: large.id,
            addOns: [],
          },
        ],
      };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      orderRepository.syncItems.mockResolvedValue({ id: "order-1" } as any);
      dishVariantRepository.findByDishId.mockResolvedValue([large, small] as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1", addOnIds: [], variantId: small.id }, authUser);

      // Assert — a fresh line for Small, the existing Large line untouched.
      const [, changes] = orderRepository.syncItems.mock.calls[0];
      expect(changes.updateQuantity).toEqual([]);
      expect(changes.create).toHaveLength(1);
      expect(changes.create[0]).toMatchObject({ dishId: "dish-1", variantId: small.id, unitPrice: small.price });
    });

    it("should merge into the existing PENDING line when the same variant is repeated", async () => {
      // Arrange
      const order = {
        id: "order-1",
        reference: "#1001",
        sessionId: openSession.id,
        status: OrderStatus.PENDING,
        items: [
          {
            id: "item-1",
            dishId: "dish-1",
            dishNameSnapshot: "Momo",
            imageUrlSnapshot: null,
            unitPrice: large.price,
            quantity: 1,
            notes: "",
            status: OrderItemStatus.PENDING,
            variantId: large.id,
            addOns: [],
          },
        ],
      };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      orderRepository.syncItems.mockResolvedValue({ id: "order-1" } as any);
      dishVariantRepository.findByDishId.mockResolvedValue([large] as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1", addOnIds: [], variantId: large.id }, authUser);

      // Assert
      const [, changes] = orderRepository.syncItems.mock.calls[0];
      expect(changes).toEqual({ create: [], updateQuantity: [{ id: "item-1", quantity: 2 }], deleteIds: [] });
    });

    it("should price the line from the selected variant instead of the dish price", async () => {
      // Arrange
      const order = { id: "order-1", reference: "#1001", sessionId: openSession.id, status: OrderStatus.PENDING, items: [] };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      orderRepository.syncItems.mockResolvedValue({ id: "order-1" } as any);
      dishVariantRepository.findByDishId.mockResolvedValue([large] as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1", addOnIds: [], variantId: large.id }, authUser);

      // Assert
      const [, changes, totals] = orderRepository.syncItems.mock.calls[0];
      expect(changes.create[0]).toMatchObject({
        unitPrice: large.price,
        variantId: large.id,
        variantNameSnapshot: large.name,
        variantPriceSnapshot: large.price,
      });
      expect(totals.subtotal).toBe(large.price);
    });

    it("should throw BadRequestException when the dish has variants but none was chosen", async () => {
      // Arrange
      const order = { id: "order-1", reference: "#1001", sessionId: openSession.id, status: OrderStatus.PENDING, items: [] };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      dishVariantRepository.findByDishId.mockResolvedValue([large] as any);

      // Act & Assert
      await expect(usecase.execute("table-1", { dishId: "dish-1", addOnIds: [] }, authUser)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.VARIANT_REQUIRED)
      );
      expect(orderRepository.syncItems).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when the chosen variant doesn't belong to the dish", async () => {
      // Arrange
      const order = { id: "order-1", reference: "#1001", sessionId: openSession.id, status: OrderStatus.PENDING, items: [] };
      orderRepository.findLatestByTableId.mockResolvedValue(order as any);
      dishVariantRepository.findByDishId.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute("table-1", { dishId: "dish-1", addOnIds: [], variantId: large.id }, authUser)).rejects.toThrow(
        new BadRequestException(ORDER_ERROR_MESSAGES.VARIANT_UNAVAILABLE)
      );
      expect(orderRepository.syncItems).not.toHaveBeenCalled();
    });

    it("should start a fresh order when the table has an open visit but nothing ordered yet", async () => {
      // Arrange — a table staff just seated: an open session, but `findLatestByTableId` finds nothing.
      orderRepository.findLatestByTableId.mockResolvedValue(null);
      orderRepository.create.mockResolvedValue({ id: "order-2", reference: "#1002" } as any);

      // Act
      const result = await usecase.execute("table-1", { dishId: "dish-1", addOnIds: [] }, authUser);

      // Assert
      expect(orderRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: authUser.restaurantId,
          branchId: authUser.branchId,
          tableId: "table-1",
          sessionId: openSession.id,
          currency: "NPR",
          items: [
            {
              dishId: "dish-1",
              dishNameSnapshot: "Momo",
              imageUrlSnapshot: null,
              unitPrice: 200,
              quantity: 1,
              notes: "",
              variantId: null,
              variantNameSnapshot: null,
              variantPriceSnapshot: null,
              addOns: [],
            },
          ],
        }),
        { tx }
      );
      expect(result).toEqual({ id: "order-2", reference: "#1002" });
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.order_item_added, subject: "Order #1002" }),
        authUser,
        tx
      );
    });

    it("should start a fresh order rather than reopening one from a visit that has since ended", async () => {
      // Arrange — the table's most recent order ever placed belongs to a session that is no longer
      // open (a prior visit); the table's *current* visit has ordered nothing yet.
      const staleOrder = { id: "order-old", reference: "#1000", sessionId: "session-old", status: OrderStatus.PENDING, items: [] };
      orderRepository.findLatestByTableId.mockResolvedValue(staleOrder as any);
      orderRepository.create.mockResolvedValue({ id: "order-2", reference: "#1002" } as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1", addOnIds: [] }, authUser);

      // Assert — a new order was started, the stale one was left untouched.
      expect(orderRepository.create).toHaveBeenCalled();
      expect(orderRepository.syncItems).not.toHaveBeenCalled();
    });

    it("should start a fresh order rather than reopening this visit's own order once it's been settled", async () => {
      // Arrange — same open visit, but its one order so far has already been paid up (or voided);
      // one more plate is a new round of service, not a correction to a closed-out ticket.
      const settledOrder = { id: "order-1", reference: "#1001", sessionId: openSession.id, status: OrderStatus.COMPLETED, items: [] };
      orderRepository.findLatestByTableId.mockResolvedValue(settledOrder as any);
      orderRepository.create.mockResolvedValue({ id: "order-2", reference: "#1002" } as any);

      // Act
      await usecase.execute("table-1", { dishId: "dish-1", addOnIds: [] }, authUser);

      // Assert
      expect(orderRepository.create).toHaveBeenCalledWith(expect.objectContaining({ sessionId: openSession.id }), { tx });
      expect(orderRepository.syncItems).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the table isn't this restaurant's", async () => {
      // Arrange
      diningTableRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("table-1", { dishId: "dish-1", addOnIds: [] }, authUser)).rejects.toThrow(
        new NotFoundException(ORDER_ERROR_MESSAGES.TABLE_NOT_FOUND)
      );
    });

    it("should throw NotFoundException when the table has no open visit to order against", async () => {
      // Arrange
      orderRepository.findLatestByTableId.mockResolvedValue(null);
      diningSessionRepository.findOpenByTableId.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("table-1", { dishId: "dish-1", addOnIds: [] }, authUser)).rejects.toThrow(
        new NotFoundException(ORDER_ERROR_MESSAGES.NO_OPEN_VISIT_FOR_TABLE)
      );
    });

    it("should throw NotFoundException when the dish isn't on this restaurant's menu", async () => {
      // Arrange
      orderRepository.findLatestByTableId.mockResolvedValue({ id: "order-1", reference: "#1001", items: [] } as any);
      dishRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("table-1", { dishId: "dish-1", addOnIds: [] }, authUser)).rejects.toThrow(NotFoundException);
    });
  });
});
