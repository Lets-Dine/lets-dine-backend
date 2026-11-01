import { FetchSessionPaymentUsecase } from "../fetch-session-payment.usecase";

const payment = { id: "pay-1" };

function build(session: { id: string; endedAt: Date | null }, billed: { orderItemId: string | null; quantity: number }[]) {
  const paymentRepository = { billedItems: jest.fn().mockResolvedValue(billed), findBySessionId: jest.fn().mockResolvedValue(payment) };
  const usecase = new FetchSessionPaymentUsecase({ findByToken: jest.fn().mockResolvedValue(session) } as any, paymentRepository as any);
  return usecase;
}

describe("FetchSessionPaymentUsecase", () => {
  it("shows no receipt while a table is still being paid share by share", async () => {
    expect(await build({ id: "s", endedAt: null }, [{ orderItemId: "item-1", quantity: 1 }]).execute("t")).toBeNull();
  });

  it("shows the receipt once the visit has ended", async () => {
    expect(await build({ id: "s", endedAt: new Date() }, [{ orderItemId: "item-1", quantity: 1 }]).execute("t")).toBe(payment);
  });

  it("still shows a whole-table bill on an open session", async () => {
    expect(await build({ id: "s", endedAt: null }, []).execute("t")).toBe(payment);
  });
});
