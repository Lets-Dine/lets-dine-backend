import { Test, TestingModule } from "@nestjs/testing";
import { AuditAction, StaffRole } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ConflictException, ForbiddenException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { DiningSessionService } from "../../../../dining-sessions/application/dining-session.service";
import { DiningSessionRepository } from "../../../../dining-sessions/domain/repositories/dining-session.repository";
import { AddOnRepository } from "../../../../add-ons/domain/repositories/add-on.repository";
import { DishVariantRepository } from "../../../../dish-variants/domain/repositories/dish-variant.repository";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { OrderRepository } from "../../../../orders/domain/repositories/order.repository";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { PAYMENT_ERROR_MESSAGES } from "../../../domain/constants";
import { PaymentRepository } from "../../../domain/repositories/payment.repository";
import { CompletePaymentUsecase } from "../complete-payment.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
const session = { id: "session-1", restaurantId: authUser.restaurantId, branchId: authUser.branchId, tableId: "table-1", endedAt: null };
const restaurant = { id: authUser.restaurantId, serviceChargeRate: 0.1, taxRate: 0.13, currency: "NPR" };
const dish = { id: "dish-1", restaurantId: authUser.restaurantId, branchId: authUser.branchId, name: "Momo", price: 200 };
const requestItems = [{ dishId: "dish-1", addOnIds: [], quantity: 2 }];
const method = "CASH" as const;
const floorOrder = {
  id: "order-1",
  reference: "#1001",
  sessionId: "session-1",
  orderType: "DINE_IN",
  floorId: "floor-1",
  floorName: "3rd Floor",
  cancelledAt: null,
  paidAt: null,
  completedAt: null,
  status: "UNPAID",
  items: [{ status: "SERVED" }],
};

describe("CompletePaymentUsecase", () => {
  let usecase: CompletePaymentUsecase;
  let paymentRepository: jest.Mocked<PaymentRepository>;
  let diningSessionRepository: jest.Mocked<DiningSessionRepository>;
  let diningSessionService: jest.Mocked<DiningSessionService>;
  let dishRepository: jest.Mocked<DishRepository>;
  let dishVariantRepository: jest.Mocked<DishVariantRepository>;
  let addOnRepository: jest.Mocked<AddOnRepository>;
  let orderRepository: jest.Mocked<OrderRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let auditLogService: jest.Mocked<AuditLogService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompletePaymentUsecase,
        { provide: PaymentRepository, useValue: { $transaction: jest.fn(fn => fn(tx)), create: jest.fn() } },
        { provide: DiningSessionRepository, useValue: { findById: jest.fn() } },
        { provide: DiningSessionService, useValue: { endSession: jest.fn() } },
        { provide: DishRepository, useValue: { findManyByIds: jest.fn() } },
        { provide: DishVariantRepository, useValue: { findById: jest.fn() } },
        { provide: AddOnRepository, useValue: { findManyByIds: jest.fn() } },
        {
          provide: OrderRepository,
          useValue: { findById: jest.fn(), findBySessionId: jest.fn().mockResolvedValue([]), update: jest.fn() },
        },
        { provide: RestaurantRepository, useValue: { findByIdForBranch: jest.fn() } },
        { provide: AuditLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(CompletePaymentUsecase);
    paymentRepository = module.get(PaymentRepository);
    diningSessionRepository = module.get(DiningSessionRepository);
    diningSessionService = module.get(DiningSessionService);
    dishRepository = module.get(DishRepository);
    dishVariantRepository = module.get(DishVariantRepository);
    addOnRepository = module.get(AddOnRepository);
    orderRepository = module.get(OrderRepository);
    restaurantRepository = module.get(RestaurantRepository);
    auditLogService = module.get(AuditLogService);
    eventEmitter = module.get(EventEmitter2);

    diningSessionRepository.findById.mockResolvedValue(session as any);
    restaurantRepository.findByIdForBranch.mockResolvedValue(restaurant as any);
    dishRepository.findManyByIds.mockResolvedValue([dish] as any);
  });

  describe("execute", () => {
    it("should charge for exactly the items the cashier sent, priced fresh off the dish", async () => {
      // Arrange
      const payment = { id: "payment-1", total: 452, currency: "NPR" };
      paymentRepository.create.mockResolvedValue(payment as any);

      // Act
      const result = await usecase.execute({ sessionId: "session-1", items: requestItems, method }, authUser);

      // Assert
      expect(result).toBe(payment);
      const [createArgs] = paymentRepository.create.mock.calls[0];
      expect(createArgs.sessionId).toBe("session-1");
      expect(createArgs.tableId).toBe("table-1");
      expect(createArgs.subtotal).toBe(400);
      expect(createArgs.items).toEqual([{ dishId: "dish-1", dishNameSnapshot: "Momo", unitPrice: 200, quantity: 2 }]);
      expect(auditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.payment_completed, subject: "Session session-1" }),
        authUser,
        tx
      );
      expect(diningSessionService.endSession).not.toHaveBeenCalled();
    });

    describe("variants and add-ons", () => {
      const large = { id: "variant-large", dishId: "dish-1", name: "Large", price: 350 };
      const cheese = { id: "addon-cheese", branchId: authUser.branchId, name: "Extra cheese", price: 40 };

      beforeEach(() => {
        paymentRepository.create.mockResolvedValue({ id: "payment-1" } as any);
        dishVariantRepository.findById.mockResolvedValue(large as any);
        addOnRepository.findManyByIds.mockResolvedValue([cheese] as any);
      });

      it("should charge the variant's own price instead of the dish's base price", async () => {
        await usecase.execute(
          { sessionId: "session-1", items: [{ dishId: "dish-1", variantId: "variant-large", addOnIds: [], quantity: 2 }], method },
          authUser
        );

        const [createArgs] = paymentRepository.create.mock.calls[0];
        expect(createArgs.items).toEqual([{ dishId: "dish-1", dishNameSnapshot: "Momo · Large", unitPrice: 350, quantity: 2 }]);
        expect(createArgs.subtotal).toBe(700);
      });

      it("should add each add-on's price on top of the dish", async () => {
        await usecase.execute(
          { sessionId: "session-1", items: [{ dishId: "dish-1", addOnIds: ["addon-cheese"], quantity: 1 }], method },
          authUser
        );

        const [createArgs] = paymentRepository.create.mock.calls[0];
        expect(createArgs.items).toEqual([{ dishId: "dish-1", dishNameSnapshot: "Momo + Extra cheese", unitPrice: 240, quantity: 1 }]);
      });

      it("should stack variant and add-ons, and keep the same dish with different choices as separate lines", async () => {
        await usecase.execute(
          {
            sessionId: "session-1",
            items: [
              { dishId: "dish-1", variantId: "variant-large", addOnIds: ["addon-cheese"], quantity: 1 },
              { dishId: "dish-1", addOnIds: [], quantity: 1 },
            ],
            method,
          },
          authUser
        );

        const [createArgs] = paymentRepository.create.mock.calls[0];
        expect(createArgs.items.map(item => item.unitPrice)).toEqual([390, 200]);
        expect(createArgs.subtotal).toBe(590);
      });

      it("should refuse a variant that belongs to a different dish", async () => {
        dishVariantRepository.findById.mockResolvedValue({ ...large, dishId: "dish-2" } as any);

        await expect(
          usecase.execute(
            { sessionId: "session-1", items: [{ dishId: "dish-1", variantId: "variant-large", addOnIds: [], quantity: 1 }], method },
            authUser
          )
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(paymentRepository.create).not.toHaveBeenCalled();
      });

      it("should refuse an add-on from another branch", async () => {
        addOnRepository.findManyByIds.mockResolvedValue([{ ...cheese, branchId: "other-branch" }] as any);

        await expect(
          usecase.execute(
            { sessionId: "session-1", items: [{ dishId: "dish-1", addOnIds: ["addon-cheese"], quantity: 1 }], method },
            authUser
          )
        ).rejects.toBeInstanceOf(NotFoundException);
      });
    });

    it("should charge a table payment to the customer its session's orders were placed under", async () => {
      // Arrange
      orderRepository.findBySessionId.mockResolvedValue([{ customerId: null }, { customerId: "customer-1" }] as any);
      paymentRepository.create.mockResolvedValue({ id: "payment-1" } as any);

      // Act
      await usecase.execute({ sessionId: "session-1", items: requestItems, method }, authUser);

      // Assert
      expect(paymentRepository.create.mock.calls[0][0].customerId).toBe("customer-1");
    });

    it("should leave the payment's customer null when nobody on the visit gave a number", async () => {
      paymentRepository.create.mockResolvedValue({ id: "payment-1" } as any);

      await usecase.execute({ sessionId: "session-1", items: requestItems, method }, authUser);

      expect(paymentRepository.create.mock.calls[0][0].customerId).toBeNull();
    });

    it("should hand the session off to the shared end-session service when asked", async () => {
      // Arrange
      paymentRepository.create.mockResolvedValue({ id: "payment-1", total: 452, currency: "NPR" } as any);

      // Act
      await usecase.execute({ sessionId: "session-1", items: requestItems, method, endSession: true }, authUser);

      // Assert
      expect(diningSessionService.endSession).toHaveBeenCalledWith(session, authUser, tx);
    });

    it("should throw NotFoundException when the session isn't this restaurant's", async () => {
      // Arrange
      diningSessionRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute({ sessionId: "session-1", items: requestItems, method }, authUser)).rejects.toThrow(
        new NotFoundException(PAYMENT_ERROR_MESSAGES.SESSION_NOT_FOUND)
      );
    });

    it("should throw ConflictException when the session has already ended", async () => {
      // Arrange
      diningSessionRepository.findById.mockResolvedValue({ ...session, endedAt: new Date() } as any);

      // Act & Assert
      await expect(usecase.execute({ sessionId: "session-1", items: requestItems, method }, authUser)).rejects.toThrow(
        new ConflictException(PAYMENT_ERROR_MESSAGES.SESSION_ALREADY_ENDED)
      );
    });

    it("should throw NotFoundException when a charged dish isn't on this restaurant's menu", async () => {
      // Arrange
      dishRepository.findManyByIds.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute({ sessionId: "session-1", items: requestItems, method }, authUser)).rejects.toThrow(NotFoundException);
    });

    it("should persist the method and pass the discount through to the totals", async () => {
      // Arrange
      paymentRepository.create.mockResolvedValue({ id: "payment-1", total: 402, currency: "NPR" } as any);

      // Act
      await usecase.execute({ sessionId: "session-1", items: requestItems, method: "CARD", discount: 50 }, authUser);

      // Assert — the discount comes off the subtotal (400 - 50 = 350) before service (35) and tax (50) are computed.
      const [createArgs] = paymentRepository.create.mock.calls[0];
      expect(createArgs.method).toBe("CARD");
      expect(createArgs.discount).toBe(50);
      expect(createArgs.total).toBe(350 + 35 + 50);
    });

    it("should throw ForbiddenException when a role without payments:discount tries to discount", async () => {
      // Arrange
      const staffUser = buildAuthEntity({ role: StaffRole.STAFF });

      // Act & Assert
      await expect(usecase.execute({ sessionId: "session-1", items: requestItems, method, discount: 50 }, staffUser)).rejects.toThrow(
        new ForbiddenException(PAYMENT_ERROR_MESSAGES.DISCOUNT_NOT_ALLOWED)
      );
    });

    it("should throw ConflictException when the discount exceeds the bill", async () => {
      // Act & Assert
      await expect(usecase.execute({ sessionId: "session-1", items: requestItems, method, discount: 100000 }, authUser)).rejects.toThrow(
        new ConflictException(PAYMENT_ERROR_MESSAGES.DISCOUNT_EXCEEDS_TOTAL)
      );
    });

    describe("a floor order's own bill (orderId)", () => {
      beforeEach(() => {
        orderRepository.findById.mockResolvedValue(floorOrder as any);
        paymentRepository.create.mockResolvedValue({ id: "payment-1", total: 452, currency: "NPR" } as any);
      });

      it("should mark exactly that order paid and completed, never the whole session", async () => {
        // Arrange
        orderRepository.update.mockResolvedValue({ ...floorOrder, status: "COMPLETED", paidAt: new Date() } as any);

        // Act
        await usecase.execute({ sessionId: "session-1", orderId: "order-1", items: requestItems, method }, authUser);

        // Assert
        const [orderId, patch] = orderRepository.update.mock.calls[0];
        expect(orderId).toBe("order-1");
        expect(patch).toEqual(expect.objectContaining({ status: "COMPLETED", paidAt: expect.any(Date), completedAt: expect.any(Date) }));
        expect(eventEmitter.emit).toHaveBeenCalledWith("order.updated", expect.objectContaining({ status: "COMPLETED" }));
        expect(diningSessionService.endSession).not.toHaveBeenCalled();
      });

      it("should charge a floor payment to that order's own customer", async () => {
        orderRepository.findById.mockResolvedValue({ ...floorOrder, customerId: "customer-2" } as any);
        orderRepository.update.mockResolvedValue({ ...floorOrder, status: "COMPLETED", paidAt: new Date() } as any);

        await usecase.execute({ sessionId: "session-1", orderId: "order-1", items: requestItems, method }, authUser);

        expect(paymentRepository.create.mock.calls[0][0].customerId).toBe("customer-2");
      });

      it("should ignore endSession when scoped to one order — a floor order never fast-forwards its siblings", async () => {
        // Arrange
        orderRepository.update.mockResolvedValue({ ...floorOrder, status: "COMPLETED", paidAt: new Date() } as any);

        // Act
        await usecase.execute({ sessionId: "session-1", orderId: "order-1", items: requestItems, method, endSession: true }, authUser);

        // Assert
        expect(diningSessionService.endSession).not.toHaveBeenCalled();
      });

      it("should not complete the order yet when paying ahead of the kitchen", async () => {
        // Arrange — only one of two items has been served so far.
        const halfServed = { ...floorOrder, items: [{ status: "SERVED" }, { status: "PREPARING" }] };
        orderRepository.findById.mockResolvedValue(halfServed as any);
        orderRepository.update.mockResolvedValue({ ...halfServed, paidAt: new Date() } as any);

        // Act
        await usecase.execute({ sessionId: "session-1", orderId: "order-1", items: requestItems, method }, authUser);

        // Assert — paidAt is set, but status/completedAt stay put until the kitchen actually finishes.
        const [, patch] = orderRepository.update.mock.calls[0];
        expect(patch).toEqual(expect.objectContaining({ status: "PREPARING", paidAt: expect.any(Date), completedAt: null }));
      });

      it("should throw NotFoundException when the order isn't on this session", async () => {
        // Arrange
        orderRepository.findById.mockResolvedValue({ ...floorOrder, sessionId: "some-other-session" } as any);

        // Act & Assert
        await expect(
          usecase.execute({ sessionId: "session-1", orderId: "order-1", items: requestItems, method }, authUser)
        ).rejects.toThrow(new NotFoundException(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FOUND));
      });

      it("should throw ConflictException when the order isn't a floor order", async () => {
        // Arrange
        orderRepository.findById.mockResolvedValue({ ...floorOrder, floorId: null, floorName: null } as any);

        // Act & Assert
        await expect(
          usecase.execute({ sessionId: "session-1", orderId: "order-1", items: requestItems, method }, authUser)
        ).rejects.toThrow(new ConflictException(PAYMENT_ERROR_MESSAGES.ORDER_NOT_FLOOR));
      });

      it("should throw ConflictException when the order is already paid", async () => {
        // Arrange
        orderRepository.findById.mockResolvedValue({ ...floorOrder, paidAt: new Date() } as any);

        // Act & Assert
        await expect(
          usecase.execute({ sessionId: "session-1", orderId: "order-1", items: requestItems, method }, authUser)
        ).rejects.toThrow(new ConflictException(PAYMENT_ERROR_MESSAGES.ORDER_ALREADY_PAID));
      });
    });
  });
});
