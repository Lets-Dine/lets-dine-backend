import { buildAuthEntity } from "../../../../common/testing";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { LoyaltyService } from "../../../loyalty/application/loyalty.service";
import { OrderRepository } from "../../../orders/domain/repositories/order.repository";
import { PaymentRepository } from "../../../payments/domain/repositories/payment.repository";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";
import { DeliveryPaymentService, dispatchKey } from "../delivery-payment.service";

const authUser = buildAuthEntity();
const scope = { restaurantId: authUser.restaurantId, branchId: authUser.branchId };
const ORDER_ID = "55555555-5555-4555-8555-555555555555";

const dispatchedOrder = {
  id: ORDER_ID,
  reference: "#1042",
  ...scope,
  orderType: "DELIVERY",
  status: "OUT_FOR_DELIVERY",
  sessionId: "sess-1",
  customerId: "cust-1",
  subtotal: 90000,
  serviceCharge: 0,
  tax: 0,
  discount: 0,
  total: 105000,
  currency: "NPR",
  items: [
    { dishId: "d1", dishNameSnapshot: "Chicken Sekuwa", unitPrice: 45000, quantity: 2, status: "READY" },
    { dishId: "d2", dishNameSnapshot: "Mango Lassi", unitPrice: 19000, quantity: 1, status: "CANCELLED" },
  ],
};
const codRun = { id: "run-1", riderName: "Ramesh", partnerName: null, cashToCollect: 105000 };

function build(over: { order?: unknown; run?: unknown; alreadyOpened?: boolean } = {}) {
  const deliveryRepo = {
    findOpenAssignment: jest.fn().mockResolvedValue("run" in over ? over.run : codRun),
  };
  const orderRepo = {
    findById: jest.fn().mockResolvedValue("order" in over ? over.order : dispatchedOrder),
  };
  const paymentRepo = {
    create: jest.fn().mockImplementation(async data => ({ id: "pay-1", ...data })),
    findByIdempotencyKey: jest.fn().mockResolvedValue(over.alreadyOpened ? { id: "pay-0" } : null),
  };
  const loyalty = { earnForPayment: jest.fn() };
  const audit = { record: jest.fn() };
  const tx = {};
  const service = new DeliveryPaymentService(
    deliveryRepo as unknown as DeliveryRepository,
    orderRepo as unknown as OrderRepository,
    paymentRepo as unknown as PaymentRepository,
    loyalty as unknown as LoyaltyService,
    audit as unknown as AuditLogService
  );
  return { deliveryRepo, paymentRepo, loyalty, audit, tx, service };
}

describe("DeliveryPaymentService", () => {
  describe("openForDispatch", () => {
    it("should open an unpaid cash bill for the whole order when a cash-on-delivery order goes out", async () => {
      // Arrange
      const { paymentRepo, loyalty, audit, tx, service } = build();

      // Act
      await service.openForDispatch(ORDER_ID, authUser, tx as never);

      // Assert: the bill is the whole order, owed, with nothing collected yet
      expect(paymentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...scope,
          sessionId: "sess-1",
          customerId: "cust-1",
          total: 105000,
          paidAmount: 0,
          paymentStatus: "UNPAID",
          tenders: [],
          method: "CASH",
          idempotencyKey: dispatchKey(ORDER_ID),
        }),
        { tx }
      );
      expect(paymentRepo.create.mock.calls[0][0].items).toEqual([
        { dishId: "d1", dishNameSnapshot: "Chicken Sekuwa", unitPrice: 45000, quantity: 2 },
      ]);
      expect(loyalty.earnForPayment).toHaveBeenCalledWith(expect.objectContaining({ id: "pay-1", orderId: ORDER_ID }), tx);
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ subject: "Order #1042" }), authUser, tx);
    });

    it("should not open a bill for an order with no cash to collect (paid up front)", async () => {
      const { paymentRepo, tx, service } = build({ run: { ...codRun, cashToCollect: 0 } });

      await service.openForDispatch(ORDER_ID, authUser, tx as never);

      expect(paymentRepo.create).not.toHaveBeenCalled();
    });

    it("should not open a bill when no courier has been named yet", async () => {
      const { paymentRepo, tx, service } = build({ run: null });

      await service.openForDispatch(ORDER_ID, authUser, tx as never);

      expect(paymentRepo.create).not.toHaveBeenCalled();
    });

    it("should not open a bill for an order that is not out for delivery", async () => {
      const { paymentRepo, tx, service } = build({ order: { ...dispatchedOrder, status: "READY" } });

      await service.openForDispatch(ORDER_ID, authUser, tx as never);

      expect(paymentRepo.create).not.toHaveBeenCalled();
    });

    it("should never open a second bill for the same order", async () => {
      const { paymentRepo, tx, service } = build({ alreadyOpened: true });

      await service.openForDispatch(ORDER_ID, authUser, tx as never);

      expect(paymentRepo.create).not.toHaveBeenCalled();
    });
  });
});
