import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { CollectPaymentUsecase } from "../collect-payment.usecase";
import { RefundPaymentUsecase } from "../refund-payment.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;

/** A one-sale in-memory stand-in for the repository whose conditional update behaves like the SQL one. */
function sale(total: number, paid = 0) {
  const state = { total, paid, refunded: 0, tenders: [] as any[], refunds: [] as any[], expenseRows: [] as any[], keys: new Set<string>() };
  const view = () => ({
    id: "pay-1",
    currency: "NPR",
    total: state.total,
    paidAmount: state.paid,
    refundedAmount: state.refunded,
    paymentStatus: state.paid >= state.total ? "PAID" : state.paid > 0 ? "PARTIALLY_PAID" : "UNPAID",
    tenders: state.tenders,
    refunds: state.refunds,
  });
  const repo = {
    $transaction: jest.fn(fn => fn(tx)),
    findById: jest.fn(async (id: string) => (id === "pay-1" ? view() : null)),
    findTenderByKey: jest.fn(async (_r: string, key: string) => (state.keys.has(`t:${key}`) ? { id: "t", paymentId: "pay-1" } : null)),
    findRefundByKey: jest.fn(async (_r: string, key: string) => (state.keys.has(`r:${key}`) ? { id: "r", paymentId: "pay-1" } : null)),
    addTender: jest.fn(async (_id: string, _actor: any, t: any) => {
      if (state.paid + t.amount > state.total) return null;
      state.paid += t.amount;
      state.keys.add(`t:${t.idempotencyKey}`);
      const row = { id: `t${state.tenders.length}`, ...t };
      state.tenders.push(row);
      return row;
    }),
    addRefund: jest.fn(async (_id: string, _actor: any, r: any) => {
      if (state.refunded + r.amount > state.paid) return null;
      state.refunded += r.amount;
      state.keys.add(`r:${r.idempotencyKey}`);
      const row = { id: `r${state.refunds.length}`, ...r };
      state.refunds.push(row);
      state.expenseRows.push({ paymentRefundId: row.id, amount: r.amount });
      return row;
    }),
  };
  return { state, repo };
}

describe("CollectPaymentUsecase", () => {
  const audit = { record: jest.fn() };
  const build = (s: ReturnType<typeof sale>) => new CollectPaymentUsecase(s.repo as any, audit as any);
  beforeEach(() => audit.record.mockClear());

  it("settles a Rs 2,000 credit sale in two steps: PARTIALLY_PAID at Rs 1,000, PAID at Rs 2,000", async () => {
    const s = sale(2000);
    const usecase = build(s);

    const half = await usecase.execute("pay-1", { amount: 1000, method: "CASH", reference: "", idempotencyKey: "key-aaaaaaaa" }, authUser);
    expect(half).toMatchObject({ paidAmount: 1000, paymentStatus: "PARTIALLY_PAID" });
    expect(2000 - half.paidAmount).toBe(1000);

    const full = await usecase.execute(
      "pay-1",
      { amount: 1000, method: "QR", reference: "FP-1", idempotencyKey: "key-bbbbbbbb" },
      authUser
    );
    expect(full).toMatchObject({ paidAmount: 2000, paymentStatus: "PAID" });
    expect(s.state.tenders.map(t => t.method)).toEqual(["CASH", "QR"]); // one tender per money movement
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.payment_collected }), authUser, tx);
  });

  it("collects once when the same request is retried", async () => {
    const s = sale(2000);
    const usecase = build(s);
    const dto = { amount: 1000, method: "CASH" as const, reference: "", idempotencyKey: "key-retry-1" };

    await usecase.execute("pay-1", dto, authUser);
    await usecase.execute("pay-1", dto, authUser);

    expect(s.state.tenders).toHaveLength(1);
    expect(s.state.paid).toBe(1000);
  });

  it("refuses more than is still owed", async () => {
    const s = sale(2000, 1500);
    await expect(
      build(s).execute("pay-1", { amount: 1000, method: "CASH", reference: "", idempotencyKey: "key-over-1" }, authUser)
    ).rejects.toBeInstanceOf(ConflictException);
    expect(s.state.tenders).toHaveLength(0);
  });

  it("lets only one of two simultaneous attempts to settle the same last Rs 1,000 through", async () => {
    const s = sale(2000, 1000);
    const usecase = build(s);
    const attempt = (key: string) =>
      usecase.execute("pay-1", { amount: 1000, method: "CASH", reference: "", idempotencyKey: key }, authUser);

    const results = await Promise.allSettled([attempt("key-race-aaa"), attempt("key-race-bbb")]);

    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    expect(s.state.paid).toBe(2000); // never over-collected
  });

  it("rolls back: a failing audit write propagates out of the transaction so the collection is not committed", async () => {
    const s = sale(2000);
    audit.record.mockRejectedValueOnce(new Error("audit down"));
    await expect(
      build(s).execute("pay-1", { amount: 500, method: "CASH", reference: "", idempotencyKey: "key-fail-1" }, authUser)
    ).rejects.toThrow("audit down");
    // The real $transaction rolls everything inside back on a throw; the use case does all its writes inside it.
    expect(s.repo.$transaction).toHaveBeenCalledTimes(1);
  });

  it("refuses a key that was already used to collect on a different bill", async () => {
    const s = sale(2000);
    s.repo.findTenderByKey.mockResolvedValue({ id: "t", paymentId: "other-sale" } as any);
    await expect(
      build(s).execute("pay-1", { amount: 100, method: "CASH", reference: "", idempotencyKey: "key-shared-1" }, authUser)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("answers a racing duplicate with the first result instead of an error", async () => {
    const s = sale(2000);
    // First pass loses the race on the unique index; the retry finds the other request's collection.
    s.repo.addTender.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }));
    s.repo.findTenderByKey.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "t", paymentId: "pay-1" } as any);
    const result = await build(s).execute(
      "pay-1",
      { amount: 500, method: "CASH", reference: "", idempotencyKey: "key-race-dup" },
      authUser
    );
    expect(result.id).toBe("pay-1");
    expect(s.repo.addTender).toHaveBeenCalledTimes(1);
  });

  it("is scoped to the caller's own restaurant: an unknown payment is not found", async () => {
    await expect(
      build(sale(2000)).execute("someone-elses", { amount: 100, method: "CASH", reference: "", idempotencyKey: "key-tenant-1" }, authUser)
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("RefundPaymentUsecase", () => {
  const audit = { record: jest.fn() };
  const build = (s: ReturnType<typeof sale>) => new RefundPaymentUsecase(s.repo as any, audit as any);

  it("refunds Rs 500 of a paid Rs 2,000 sale as its own record plus one cash-book outflow, leaving the payment's collected amount alone", async () => {
    const s = sale(2000, 2000);
    const result = await build(s).execute(
      "pay-1",
      { amount: 500, method: "CASH", reason: "cold food", idempotencyKey: "refund-key-1" },
      authUser
    );

    expect(result).toMatchObject({ paidAmount: 2000, refundedAmount: 500 });
    expect(s.state.expenseRows).toHaveLength(1);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: AuditAction.payment_refunded }), authUser, tx);
  });

  it("does not refund twice when the request is retried", async () => {
    const s = sale(2000, 2000);
    const dto = { amount: 500, method: "CASH" as const, reason: "", idempotencyKey: "refund-retry" };
    const usecase = build(s);
    await usecase.execute("pay-1", dto, authUser);
    await usecase.execute("pay-1", dto, authUser);
    expect(s.state.refunds).toHaveLength(1);
    expect(s.state.expenseRows).toHaveLength(1);
  });

  it("cannot refund more than was collected, nor money never collected on a credit sale", async () => {
    await expect(
      build(sale(2000, 2000)).execute("pay-1", { amount: 2500, method: "CASH", reason: "", idempotencyKey: "refund-over-1" }, authUser)
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(sale(2000, 0)).execute("pay-1", { amount: 100, method: "CASH", reason: "", idempotencyKey: "refund-none-1" }, authUser)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a collection that is not one of this bill's", async () => {
    await expect(
      build(sale(2000, 2000)).execute(
        "pay-1",
        { amount: 100, method: "CASH", reason: "", tenderId: "11111111-1111-4111-8111-111111111111", idempotencyKey: "refund-tender-1" },
        authUser
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("only refunds against a collection that succeeded, by the same method, and no more than it took", async () => {
    const mk = (tender: object) => {
      const s = sale(2000, 2000);
      s.state.tenders.push({ id: "11111111-1111-4111-8111-111111111111", amount: 500, method: "QR", status: "SUCCEEDED", ...tender });
      return s;
    };
    const dto = { amount: 500, method: "QR" as const, reason: "", tenderId: "11111111-1111-4111-8111-111111111111" };
    await expect(
      build(mk({ status: "FAILED" })).execute("pay-1", { ...dto, idempotencyKey: "refund-t-failed" }, authUser)
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(mk({})).execute("pay-1", { ...dto, method: "CASH", idempotencyKey: "refund-t-method" }, authUser)
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(mk({})).execute("pay-1", { ...dto, amount: 600, idempotencyKey: "refund-t-amount" }, authUser)
    ).rejects.toBeInstanceOf(ConflictException);
    const ok = await build(mk({})).execute("pay-1", { ...dto, idempotencyKey: "refund-t-fine" }, authUser);
    expect(ok.refundedAmount).toBe(500);
  });
});
