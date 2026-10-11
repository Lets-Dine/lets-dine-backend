import { StaffRole } from "@prisma/client";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { LedgerRepository } from "../../../../ledger/domain/repositories/ledger.repository";
import { OrderRepository } from "../../../../orders/domain/repositories/order.repository";
import { LoyaltyService } from "../../../../loyalty/application/loyalty.service";
import { PaymentRepository } from "../../../../payments/domain/repositories/payment.repository";
import { DELIVERY_ERROR_MESSAGES } from "../../../domain/constants";
import { DeliveryRepository } from "../../../domain/repositories/delivery.repository";
import { SettleDeliveryOrderUsecase } from "../settle-delivery-order.usecase";

const authUser = buildAuthEntity();
const scope = { restaurantId: authUser.restaurantId, branchId: authUser.branchId };
const ORDER_ID = "55555555-5555-4555-8555-555555555555";

const order = {
  id: ORDER_ID,
  reference: "#1042",
  ...scope,
  orderType: "DELIVERY",
  status: "SETTLE",
  sessionId: "sess-1",
  customerId: "cust-1",
  subtotal: 90000,
  serviceCharge: 0,
  tax: 0,
  discount: 0,
  total: 105000,
  currency: "NPR",
  items: [
    { dishId: "d1", dishNameSnapshot: "Chicken Sekuwa", unitPrice: 45000, quantity: 2, status: "SERVED" },
    { dishId: "d2", dishNameSnapshot: "Mango Lassi", unitPrice: 19000, quantity: 1, status: "CANCELLED" },
  ],
};
const run = {
  id: "run-1",
  riderName: "Ramesh",
  partnerName: null,
  accountKind: "RIDER",
  accountId: "66666666-6666-4666-8666-666666666666",
  cashToCollect: 105000,
  cashCollected: 100000,
  courierFee: 6000,
};
const dto = { payFee: true, feeMethod: "CASH" as const };

function build(over: { order?: unknown; run?: unknown } = {}) {
  const deliveryRepo = {
    $transaction: jest.fn(fn => fn({})),
    findDeliveredAssignment: jest.fn().mockResolvedValue("run" in over ? over.run : run),
    createSettlement: jest.fn().mockImplementation(async data => ({ id: `st-${data.direction}`, ...data })),
  };
  const orderRepo = {
    findById: jest.fn().mockResolvedValue("order" in over ? over.order : order),
    update: jest.fn().mockImplementation(async (id, patch) => ({ ...order, id, ...patch })),
  };
  const paymentRepo = { create: jest.fn().mockImplementation(async data => ({ id: "pay-1", ...data })) };
  const ledger = { createExpense: jest.fn() };
  const audit = { record: jest.fn() };
  const events = { emit: jest.fn() };
  const loyalty = { earnForPayment: jest.fn() };
  const usecase = new SettleDeliveryOrderUsecase(
    deliveryRepo as unknown as DeliveryRepository,
    orderRepo as unknown as OrderRepository,
    paymentRepo as unknown as PaymentRepository,
    ledger as unknown as LedgerRepository,
    audit as unknown as AuditLogService,
    events as never,
    loyalty as unknown as LoyaltyService
  );
  return { deliveryRepo, orderRepo, paymentRepo, ledger, audit, events, loyalty, usecase };
}

describe("SettleDeliveryOrderUsecase", () => {
  describe("execute", () => {
    it("should book the sale as a cash payment, complete the order, take the courier's cash and pay the fee", async () => {
      // Arrange
      const { deliveryRepo, orderRepo, paymentRepo, ledger, events, usecase } = build();

      // Act
      const result = await usecase.execute(ORDER_ID, dto, authUser);

      // Assert: the sale — cancelled lines are not on it
      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...scope,
          sessionId: "sess-1",
          tableId: null,
          customerId: "cust-1",
          total: 105000,
          method: "CASH",
          currency: "NPR",
          createdBy: authUser.sub,
        }),
        expect.anything()
      );
      expect(paymentRepo.create.mock.calls[0][0].items).toEqual([
        { dishId: "d1", dishNameSnapshot: "Chicken Sekuwa", unitPrice: 45000, quantity: 2 },
      ]);
      // The order is completed and stamped paid
      expect(orderRepo.update).toHaveBeenCalledWith(
        ORDER_ID,
        expect.objectContaining({ status: "COMPLETED", paidAt: expect.any(Date), completedAt: expect.any(Date) }),
        expect.anything()
      );
      expect(result.status).toBe("COMPLETED");
      expect(events.emit).toHaveBeenCalledWith("order.updated", result);
      // The courier's cash is received against the order, and posts nothing of its own (the payment counted it)
      expect(deliveryRepo.createSettlement).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "COLLECT", amount: 100000, orderId: ORDER_ID, accountKind: "RIDER", note: "Order #1042" }),
        expect.anything()
      );
      // The fee is paid and is the only cash-book row this posts
      expect(deliveryRepo.createSettlement).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "PAYOUT", amount: 6000, method: "CASH", orderId: ORDER_ID }),
        expect.anything()
      );
      expect(ledger.createExpense).toHaveBeenCalledTimes(1);
      expect(ledger.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "EXPENSE",
          amount: 6000,
          method: "CASH",
          category: "Delivery fees",
          deliverySettlementId: "st-PAYOUT",
        }),
        expect.anything()
      );
    });

    it("should earn loyalty points on the settled payment inside the same transaction", async () => {
      // Arrange
      const { deliveryRepo, loyalty, usecase } = build();
      const tx = {};
      deliveryRepo.$transaction.mockImplementation(fn => fn(tx));

      // Act
      await usecase.execute(ORDER_ID, dto, authUser);

      // Assert
      expect(loyalty.earnForPayment).toHaveBeenCalledWith(expect.objectContaining({ id: "pay-1", orderId: ORDER_ID }), tx);
    });

    it("should leave the fee owed when the manager chooses not to pay now", async () => {
      // Arrange
      const { deliveryRepo, ledger, usecase } = build();

      // Act
      await usecase.execute(ORDER_ID, { ...dto, payFee: false }, authUser);

      // Assert: the cash is still taken, but nothing is paid out or posted
      expect(deliveryRepo.createSettlement).toHaveBeenCalledTimes(1);
      expect(deliveryRepo.createSettlement).toHaveBeenCalledWith(expect.objectContaining({ direction: "COLLECT" }), expect.anything());
      expect(ledger.createExpense).not.toHaveBeenCalled();
    });

    it("should pay the fee from the bank when asked", async () => {
      const { ledger, usecase } = build();

      await usecase.execute(ORDER_ID, { payFee: true, feeMethod: "BANK" }, authUser);

      expect(ledger.createExpense).toHaveBeenCalledWith(expect.objectContaining({ method: "CARD", amount: 6000 }), expect.anything());
    });

    it("should book a prepaid order as a card payment with no cash to receive", async () => {
      // Arrange
      const { deliveryRepo, paymentRepo, usecase } = build({ run: { ...run, cashToCollect: 0, cashCollected: 0 } });

      // Act
      await usecase.execute(ORDER_ID, { ...dto, payFee: false }, authUser);

      // Assert
      expect(paymentRepo.create).toHaveBeenCalledWith(expect.objectContaining({ method: "CARD" }), expect.anything());
      expect(deliveryRepo.createSettlement).not.toHaveBeenCalled();
    });

    it("should settle an order that went out with no courier recorded, as a cash payment", async () => {
      // Arrange
      const { deliveryRepo, paymentRepo, ledger, orderRepo, usecase } = build({ run: null });

      // Act
      await usecase.execute(ORDER_ID, dto, authUser);

      // Assert
      expect(paymentRepo.create).toHaveBeenCalledWith(expect.objectContaining({ method: "CASH", total: 105000 }), expect.anything());
      expect(orderRepo.update).toHaveBeenCalled();
      expect(deliveryRepo.createSettlement).not.toHaveBeenCalled();
      expect(ledger.createExpense).not.toHaveBeenCalled();
    });

    it("should refuse a staff member paying the fee, but let them settle and leave it owed", async () => {
      // Arrange
      const staff = buildAuthEntity({ role: StaffRole.STAFF });
      const { paymentRepo, usecase } = build();

      // Act & Assert
      await expect(usecase.execute(ORDER_ID, dto, staff)).rejects.toBeInstanceOf(ForbiddenException);
      expect(paymentRepo.create).not.toHaveBeenCalled();
      await expect(usecase.execute(ORDER_ID, { ...dto, payFee: false }, staff)).resolves.toMatchObject({ status: "COMPLETED" });
    });

    it("should refuse an order that has not been marked delivered", async () => {
      const { paymentRepo, usecase } = build({ order: { ...order, status: "OUT_FOR_DELIVERY" } });

      await expect(usecase.execute(ORDER_ID, dto, authUser)).rejects.toMatchObject({
        message: DELIVERY_ERROR_MESSAGES.ORDER_NOT_TO_SETTLE.message,
      });
      expect(paymentRepo.create).not.toHaveBeenCalled();
    });

    it("should refuse settling the same order twice", async () => {
      const { usecase } = build({ order: { ...order, status: "COMPLETED" } });

      await expect(usecase.execute(ORDER_ID, dto, authUser)).rejects.toBeInstanceOf(ConflictException);
    });

    it("should refuse a dine-in order", async () => {
      const { usecase } = build({ order: { ...order, orderType: "DINE_IN" } });

      await expect(usecase.execute(ORDER_ID, dto, authUser)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("should treat another branch's order as missing", async () => {
      const { paymentRepo, usecase } = build({ order: { ...order, branchId: "other-branch" } });

      await expect(usecase.execute(ORDER_ID, dto, authUser)).rejects.toBeInstanceOf(NotFoundException);
      expect(paymentRepo.create).not.toHaveBeenCalled();
    });
  });
});
