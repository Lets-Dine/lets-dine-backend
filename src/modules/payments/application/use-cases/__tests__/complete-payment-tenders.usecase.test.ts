import { BadRequestException, ConflictException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { CompletePaymentUsecase } from "../complete-payment.usecase";

const authUser = buildAuthEntity();
const tx = {} as any;
// Rs 2,000 net: price 2000, no service charge or tax so the totals read plainly.
const restaurant = { id: authUser.restaurantId, serviceChargeRate: 0, taxRate: 0, currency: "NPR" };
const session = {
  id: "session-1",
  restaurantId: authUser.restaurantId,
  branchId: authUser.branchId,
  tableId: "table-1",
  endedAt: null,
  customerId: null,
};
const dish = { id: "dish-1", branchId: authUser.branchId, name: "Thali", price: 2000 };
const items = [{ dishId: "dish-1", addOnIds: [], quantity: 1 }];

function build() {
  const paymentRepository = {
    $transaction: jest.fn(fn => fn(tx)),
    create: jest.fn(async data => ({ id: "pay-1", ...data })),
    findByIdempotencyKey: jest.fn().mockResolvedValue(null),
  };
  const customerRepository = { findById: jest.fn().mockResolvedValue({ id: "cust-1", name: "Sita" }) };
  const usecase = new CompletePaymentUsecase(
    paymentRepository as any,
    { findById: jest.fn().mockResolvedValue(session) } as any,
    { endSession: jest.fn() } as any,
    { findManyByIds: jest.fn().mockResolvedValue([dish]) } as any,
    { findById: jest.fn() } as any,
    { findManyByIds: jest.fn().mockResolvedValue([]) } as any,
    { findById: jest.fn(), findBySessionId: jest.fn().mockResolvedValue([]), update: jest.fn() } as any,
    { findByIdForBranch: jest.fn().mockResolvedValue(restaurant) } as any,
    { record: jest.fn() } as any,
    { emit: jest.fn() } as any,
    { earnForPayment: jest.fn(), planRedemption: jest.fn(), recordRedemption: jest.fn() } as any,
    customerRepository as any
  );
  return { usecase, paymentRepository };
}
const created = (r: ReturnType<typeof build>) => r.paymentRepository.create.mock.calls[0][0];

describe("CompletePaymentUsecase — collections", () => {
  it("workflow 1: a Rs 2,000 sale paid in cash is one PAID sale with one Rs 2,000 collection", async () => {
    const r = build();
    await r.usecase.execute({ sessionId: "session-1", items, method: "CASH" }, authUser);
    expect(created(r)).toMatchObject({ total: 2000, paidAmount: 2000, paymentStatus: "PAID", tenders: [{ method: "CASH", amount: 2000 }] });
  });

  it("splits Rs 1,000 cash + Rs 1,000 QR on a Rs 2,000 sale into two collections on one sale", async () => {
    const r = build();
    await r.usecase.execute(
      {
        sessionId: "session-1",
        items,
        tenders: [
          { method: "CASH", amount: 1000 },
          { method: "QR", amount: 1000 },
        ],
      },
      authUser
    );
    expect(created(r)).toMatchObject({ paymentStatus: "PAID", paidAmount: 2000 });
    expect(created(r).tenders).toHaveLength(2);
  });

  it("workflow 2: a credit sale is one UNPAID sale of Rs 2,000 with no collection at all", async () => {
    const r = build();
    await r.usecase.execute({ sessionId: "session-1", items, credit: true, customerId: "11111111-1111-4111-8111-111111111111" }, authUser);
    expect(created(r)).toMatchObject({ total: 2000, paidAmount: 0, paymentStatus: "UNPAID", tenders: [] });
  });

  it("takes a Rs 1,000 deposit on credit as PARTIALLY_PAID", async () => {
    const r = build();
    await r.usecase.execute(
      {
        sessionId: "session-1",
        items,
        credit: true,
        tenders: [{ method: "CASH", amount: 1000 }],
        customerId: "11111111-1111-4111-8111-111111111111",
      },
      authUser
    );
    expect(created(r)).toMatchObject({ paidAmount: 1000, paymentStatus: "PARTIALLY_PAID" });
  });

  it("refuses credit with nobody to owe it", async () => {
    await expect(build().usecase.execute({ sessionId: "session-1", items, credit: true }, authUser)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it("refuses collecting less than the bill unless it is marked credit", async () => {
    await expect(
      build().usecase.execute({ sessionId: "session-1", items, tenders: [{ method: "CASH", amount: 500 }] }, authUser)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("refuses collecting more than the server-computed bill, whatever the client says", async () => {
    await expect(
      build().usecase.execute({ sessionId: "session-1", items, tenders: [{ method: "CASH", amount: 2500 }] }, authUser)
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("returns the first bill when the same idempotency key is sent again, creating nothing", async () => {
    const r = build();
    const first = { id: "pay-existing", branchId: authUser.branchId };
    r.paymentRepository.findByIdempotencyKey.mockResolvedValue(first as any);
    const result = await r.usecase.execute({ sessionId: "session-1", items, method: "CASH", idempotencyKey: "retry-key-1" }, authUser);
    expect(result).toBe(first);
    expect(r.paymentRepository.create).not.toHaveBeenCalled();
  });
});
