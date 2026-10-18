import { RemindReceivableUsecase } from "../remind-receivable.usecase";

const auth = { restaurantId: "r1", branchId: "b1", sub: "u1", name: "Asha" } as any;

describe("RemindReceivableUsecase", () => {
  const make = (owed: number) => {
    const repo = { owedBy: jest.fn(async () => owed), addReminder: jest.fn(async (d: any) => ({ id: "x", createdAt: new Date(), ...d })) };
    return { repo, usecase: new RemindReceivableUsecase(repo as any) };
  };

  it("records the amount the server sees as owed, never one the client sends", async () => {
    const { repo, usecase } = make(1500);
    const out = await usecase.execute("c1", auth);
    expect(out.amount).toBe(1500);
    expect(repo.addReminder).toHaveBeenCalledWith({ restaurantId: "r1", customerId: "c1", amount: 1500, createdBy: "u1", createdByName: "Asha" });
  });

  it("refuses a customer who owes nothing, and logs nothing", async () => {
    const { repo, usecase } = make(0);
    await expect(usecase.execute("c1", auth)).rejects.toThrow();
    expect(repo.addReminder).not.toHaveBeenCalled();
  });
});
