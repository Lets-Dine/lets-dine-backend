import { AuditAction, StaffRole } from "@prisma/client";
import { ForbiddenException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { PAYMENT_ERROR_MESSAGES } from "../../../domain/constants";
import { CompletePaymentUsecase } from "../complete-payment.usecase";

const staff = buildAuthEntity({ role: StaffRole.STAFF });
const owner = buildAuthEntity();
const session = {
  id: "session-1",
  restaurantId: staff.restaurantId,
  branchId: staff.branchId,
  tableId: "table-1",
  endedAt: null,
  floorId: null,
};
const restaurant = { id: staff.restaurantId, serviceChargeRate: 0, taxRate: 0, currency: "NPR" };
const momo = { id: "momo", branchId: staff.branchId, name: "Momo", price: 200 };
const tea = { id: "tea", branchId: staff.branchId, name: "Tea", price: 50 };
const tx = { $queryRaw: jest.fn() } as any;
const orderedItem = (dishId: string, quantity: number) => ({ dishId, variantId: null, addOns: [], quantity, status: "PENDING" });
const approver = { id: "member-m", name: "Bimal Rai" };

function build(approval: { verify: jest.Mock } = { verify: jest.fn().mockResolvedValue(approver) }) {
  const paymentRepository = {
    $transaction: jest.fn(fn => fn(tx)),
    create: jest.fn(async data => ({ id: "pay-1", ...data })),
    findByIdempotencyKey: jest.fn().mockResolvedValue(null),
    billedItems: jest.fn().mockResolvedValue([]),
  };
  const audit = jest.fn();
  const orderRepository = {
    findById: jest.fn(),
    update: jest.fn(),
    // Table 1's visit: two momos and a tea, in two orders.
    findBySessionId: jest.fn().mockResolvedValue([
      { status: "PENDING", items: [orderedItem("momo", 2)] },
      { status: "PENDING", items: [orderedItem("tea", 1)] },
      { status: "CANCELLED", items: [orderedItem("momo", 9)] },
    ]),
  };
  const usecase = new CompletePaymentUsecase(
    paymentRepository as any,
    { findById: jest.fn().mockResolvedValue(session) } as any,
    { endSession: jest.fn() } as any,
    { findManyByIds: jest.fn().mockResolvedValue([momo, tea]) } as any,
    { findById: jest.fn() } as any,
    { findManyByIds: jest.fn().mockResolvedValue([]) } as any,
    orderRepository as any,
    { findByIdForBranch: jest.fn().mockResolvedValue(restaurant) } as any,
    { record: audit } as any,
    { emit: jest.fn() } as any,
    { earnForPayment: jest.fn(), planRedemption: jest.fn().mockResolvedValue(0), recordRedemption: jest.fn() } as any,
    { findById: jest.fn().mockResolvedValue({ id: "customer", name: "Sita" }) } as any,
    approval as any
  );
  return { usecase, paymentRepository, audit, approval, orderRepository };
}

const exact = [
  { dishId: "momo", addOnIds: [], quantity: 2 },
  { dishId: "tea", addOnIds: [], quantity: 1 },
];
const run = (usecase: CompletePaymentUsecase, body: object, who = staff) =>
  usecase.execute({ sessionId: "session-1", method: "CASH", ...body } as never, who);
const needsApproval = (reasons: string[]) => ({
  exception: { key: PAYMENT_ERROR_MESSAGES.APPROVAL_REQUIRED.key, detail: expect.objectContaining({ reasons, sessionId: "session-1" }) },
});

describe("CompletePaymentUsecase approvals", () => {
  it("should let a cashier take exactly what was ordered, with no approval and none asked for", async () => {
    const { usecase, paymentRepository, approval } = build();
    await run(usecase, { items: exact });
    expect(paymentRepository.create).toHaveBeenCalledTimes(1);
    expect(approval.verify).not.toHaveBeenCalled();
  });

  it("should ask for approval when a cashier drops a line, lowers a quantity, adds a line or swaps a dish", async () => {
    for (const items of [
      [{ dishId: "momo", addOnIds: [], quantity: 2 }],
      [
        { dishId: "momo", addOnIds: [], quantity: 1 },
        { dishId: "tea", addOnIds: [], quantity: 1 },
      ],
      [...exact, { dishId: "tea", addOnIds: [], quantity: 1 }],
      [
        { dishId: "tea", addOnIds: [], quantity: 2 },
        { dishId: "tea", addOnIds: [], quantity: 1 },
      ],
    ]) {
      const { usecase, paymentRepository } = build();
      await expect(run(usecase, { items })).rejects.toMatchObject(needsApproval(["lines"]));
      expect(paymentRepository.create).not.toHaveBeenCalled();
    }
  });

  it("should ask for approval for a discount, and say both reasons when the bill changed as well", async () => {
    await expect(run(build().usecase, { items: exact, discount: 20 })).rejects.toMatchObject(needsApproval(["discount"]));
    await expect(run(build().usecase, { items: [exact[0]], discount: 20 })).rejects.toMatchObject(needsApproval(["discount", "lines"]));
  });

  it("should go through with a manager's approval, and record who approved what", async () => {
    const { usecase, paymentRepository, audit, approval } = build();
    await run(usecase, { items: [exact[0]], discount: 20, approval: { memberId: approver.id, pin: "4821" } });
    expect(approval.verify).toHaveBeenCalledWith({ memberId: approver.id, pin: "4821" }, staff);
    expect(paymentRepository.create).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.payment_override_approved,
        subject: "Bimal Rai",
        detail: expect.stringContaining("Aarati Shrestha"),
      }),
      staff,
      tx
    );
  });

  it("should not charge anything when the approval is refused", async () => {
    const refused = { verify: jest.fn().mockRejectedValue(new ForbiddenException(PAYMENT_ERROR_MESSAGES.APPROVAL_INVALID)) };
    const { usecase, paymentRepository } = build(refused);
    await expect(run(usecase, { items: [exact[0]], approval: { memberId: approver.id, pin: "0000" } })).rejects.toThrow(
      PAYMENT_ERROR_MESSAGES.APPROVAL_INVALID.message
    );
    expect(paymentRepository.create).not.toHaveBeenCalled();
  });

  it("should not need approval from someone who can discount, and should not ask anyone for it", async () => {
    const { usecase, paymentRepository, approval, audit } = build();
    await run(usecase, { items: [exact[0]], discount: 20, approval: { memberId: approver.id, pin: "4821" } }, owner);
    expect(paymentRepository.create).toHaveBeenCalledTimes(1);
    expect(approval.verify).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: AuditAction.payment_override_approved }),
      expect.anything(),
      expect.anything()
    );
  });

  it("should hold a floor order to its own lines, not the whole session's", async () => {
    const { usecase, orderRepository } = build();
    orderRepository.findById.mockResolvedValue({
      id: "order-1",
      reference: "#1",
      sessionId: "session-1",
      floorId: "floor-1",
      paidAt: null,
      cancelledAt: null,
      orderType: "DINE_IN",
      status: "UNPAID",
      items: [orderedItem("tea", 1)],
    });
    await run(usecase, { orderId: "order-1", items: [{ dishId: "tea", addOnIds: [], quantity: 1 }] });
    await expect(run(usecase, { orderId: "order-1", items: [{ dishId: "tea", addOnIds: [], quantity: 2 }] })).rejects.toMatchObject(
      needsApproval(["lines"])
    );
  });

  it("should tell the approver what they are approving: the discount, and how the bill differs from the order", async () => {
    const { usecase } = build();
    await expect(run(usecase, { items: [exact[0]], discount: 20 })).rejects.toMatchObject({
      exception: { detail: expect.objectContaining({ discount: 20, currency: "NPR", ordered: 3, charged: 2 }) },
    });
  });

  it("should not test a PIN for a payment that needed no approval, even when one was sent", async () => {
    const { usecase, approval, paymentRepository } = build();
    await run(usecase, { items: exact, approval: { memberId: approver.id, pin: "0000" } });
    expect(approval.verify).not.toHaveBeenCalled();
    expect(paymentRepository.create).toHaveBeenCalledTimes(1);
  });

  it("should ask for approval before points or credit are put on a customer the orders were not placed under", async () => {
    const OTHER = "55555555-5555-4555-8555-555555555555";
    await expect(run(build().usecase, { items: exact, customerId: OTHER, redeemPoints: 100 })).rejects.toMatchObject(
      needsApproval(["customer"])
    );
    await expect(run(build().usecase, { items: exact, customerId: OTHER, credit: true, method: undefined })).rejects.toMatchObject(
      needsApproval(["customer"])
    );
  });
});
