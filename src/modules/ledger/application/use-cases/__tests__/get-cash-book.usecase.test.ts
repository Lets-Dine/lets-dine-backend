import { buildAuthEntity } from "../../../../../common/testing";
import { GetCashBookUsecase } from "../get-cash-book.usecase";

const authUser = buildAuthEntity();
const from = new Date("2026-01-10T00:00:00Z");
const to = new Date("2026-01-11T00:00:00Z");
const totals = (over: object = {}) => ({
  cashSales: 0,
  cardSales: 0,
  cashExpenses: 0,
  cardExpenses: 0,
  cashIncome: 0,
  cardIncome: 0,
  deposits: 0,
  withdrawals: 0,
  ...over,
});

function build(periods: { sinceBase?: object; window?: object }) {
  const ledgerRepository = {
    findLastCloseAtOrBefore: jest
      .fn()
      .mockResolvedValue({ closedAt: new Date("2026-01-01T00:00:00Z"), closingCounted: 10000, bankCounted: 50000 }),
    sumPeriod: jest.fn().mockResolvedValueOnce(totals(periods.sinceBase)).mockResolvedValueOnce(totals(periods.window)),
  };
  const entries = { execute: jest.fn().mockResolvedValue([]) };
  return new GetCashBookUsecase(ledgerRepository as any, entries as any);
}

describe("GetCashBookUsecase", () => {
  it("rolls the opening forward from the last cash-up and reconciles to the closing balance", async () => {
    const book = await build({
      sinceBase: { cashSales: 2000, cashExpenses: 500 },
      window: { cashSales: 3000, cashExpenses: 1000, cardSales: 2000 },
    }).execute(authUser, { from, to });
    expect(book.opening).toEqual({ cash: 11500, bank: 50000 });
    expect(book.receipts).toEqual({ cash: 3000, bank: 2000 });
    expect(book.payments).toEqual({ cash: 1000, bank: 0 });
    expect(book.closing).toEqual({ cash: 13500, bank: 52000 });
  });

  it("workflow 6: a Rs 5,000 transfer moves cash to bank without changing the total", async () => {
    const book = await build({ window: { deposits: 5000 } }).execute(authUser, { from, to });
    expect(book.closing).toEqual({ cash: 5000, bank: 55000 });
    expect(book.closing.cash + book.closing.bank).toBe(book.opening.cash + book.opening.bank);
    expect(book.transfers).toEqual({ cashToBank: 5000, bankToCash: 0 });
  });

  it("workflows 2 & 3: an unpaid sale or credit purchase is not in the period totals, so cash and bank do not move", async () => {
    const book = await build({ window: {} }).execute(authUser, { from, to });
    expect(book.closing).toEqual(book.opening);
  });

  it("workflow 4: a Rs 4,000 supplier payment from the bank is a Rs 4,000 bank outflow only", async () => {
    const book = await build({ window: { cardExpenses: 4000 } }).execute(authUser, { from, to });
    expect(book.payments).toEqual({ cash: 0, bank: 4000 });
    expect(book.closing).toEqual({ cash: 10000, bank: 46000 });
  });

  it("opens at zero before any cash-up exists", async () => {
    const ledgerRepository = {
      findLastCloseAtOrBefore: jest.fn().mockResolvedValue(null),
      sumPeriod: jest.fn().mockResolvedValue(totals({ cashSales: 700 })),
    };
    const book = await new GetCashBookUsecase(ledgerRepository as any, { execute: jest.fn().mockResolvedValue([]) } as any).execute(
      authUser,
      { from, to }
    );
    expect(book.opening).toEqual({ cash: 0, bank: 0 });
  });

  it("when a cash-up falls inside the window, closes on the counted figure and shows the gap as an adjustment", async () => {
    const closeInside = { closedAt: new Date("2026-01-10T12:00:00Z"), closingCounted: 9500, bankCounted: 50000 };
    const ledgerRepository = {
      findLastCloseAtOrBefore: jest
        .fn()
        .mockResolvedValueOnce({ closedAt: new Date("2026-01-01T00:00:00Z"), closingCounted: 10000, bankCounted: 50000 })
        .mockResolvedValueOnce(closeInside),
      sumPeriod: jest
        .fn()
        .mockResolvedValueOnce(totals())
        .mockResolvedValueOnce(totals({ cashSales: 1000 }))
        .mockResolvedValueOnce(totals({ cashSales: 200 })),
    };
    const book = await new GetCashBookUsecase(ledgerRepository as any, { execute: jest.fn().mockResolvedValue([]) } as any).execute(
      authUser,
      { from, to }
    );
    expect(book.closing.cash).toBe(9700); // counted 9,500 + 200 sold after the cash-up
    expect(book.adjustment.cash).toBe(9700 - 11000); // expected 11,000: the drawer was Rs 15 short, plus the 200 taken after
  });
});
