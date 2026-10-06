import { buildAuthEntity } from "../../../../../common/testing";
import { ConflictException } from "../../../../../common/exceptions";
import { LedgerRepository } from "../../../domain/repositories/ledger.repository";
import { CloseLedgerUsecase } from "../close-ledger.usecase";

const authUser = buildAuthEntity();
const totals = {
  cashSales: 5000,
  cardSales: 2000,
  cashExpenses: 1200,
  cardExpenses: 300,
  cashIncome: 500,
  cardIncome: 0,
  deposits: 3000,
  withdrawals: 0,
};

function build(last: { closedAt: Date; closingCounted: number; bankCounted: number } | null, closes = 2) {
  const repo = {
    $transaction: jest.fn(fn => fn({})),
    findLastClose: jest.fn().mockResolvedValue(last),
    countCloses: jest.fn().mockResolvedValue(closes),
    findBranchTimezone: jest.fn().mockResolvedValue("Asia/Kathmandu"),
    sumPeriod: jest.fn().mockResolvedValue(totals),
    createClose: jest.fn(async data => data),
  };
  return { repo, usecase: new CloseLedgerUsecase(repo as unknown as LedgerRepository) };
}

describe("CloseLedgerUsecase", () => {
  it("opens the period with the previous counted cash and records the drawer variance", async () => {
    const { usecase } = build({ closedAt: new Date("2026-10-05T18:00:00Z"), closingCounted: 10000, bankCounted: 20000 });

    const close = await usecase.execute({ closingCounted: 11300, bankCounted: 24700, note: "" }, authUser);

    expect(close).toMatchObject({
      opening: 10000,
      ...totals,
      closingExpected: 11300,
      closingCounted: 11300,
      variance: 0,
      bankOpening: 20000,
      bankExpected: 24700,
      bankVariance: 0,
    });
  });

  it("treats a branch's first close as its opening float, ignoring earlier payments", async () => {
    const { repo, usecase } = build(null);

    const close = await usecase.execute({ closingCounted: 5000, bankCounted: 8000, note: "" }, authUser);

    expect(repo.sumPeriod).not.toHaveBeenCalled();
    expect(close).toMatchObject({ opening: 5000, bankOpening: 8000, cashSales: 0, closingExpected: 5000, bankExpected: 8000, variance: 0 });
  });

  it("refuses a second close on the same day in the branch's timezone", async () => {
    const { usecase } = build({ closedAt: new Date(), closingCounted: 10000, bankCounted: 20000 });

    await expect(usecase.execute({ closingCounted: 1, bankCounted: 1, note: "" }, authUser)).rejects.toBeInstanceOf(ConflictException);
  });

  it("lets the first real close follow the opening setup on the same day", async () => {
    const { usecase } = build({ closedAt: new Date(), closingCounted: 10000, bankCounted: 20000 }, 1);

    await expect(usecase.execute({ closingCounted: 10000, bankCounted: 20000, note: "" }, authUser)).resolves.toMatchObject({
      opening: 10000,
    });
  });
});
