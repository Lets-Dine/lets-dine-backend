import { Test, TestingModule } from "@nestjs/testing";
import { buildAuthEntity } from "../../../../../common/testing";
import { EntitlementService } from "../../../../billing/application/entitlement.service";
import { AnalyticsRepository } from "../../../domain/repositories/analytics.repository";
import { FetchProfitLossUsecase } from "../fetch-profit-loss.usecase";

const authUser = buildAuthEntity();
const branchId = "11111111-1111-4111-8111-111111111111";
const from = new Date("2026-01-01T00:00:00Z");
const to = new Date("2026-02-01T00:00:00Z");

describe("FetchProfitLossUsecase", () => {
  let usecase: FetchProfitLossUsecase;
  let analyticsRepository: jest.Mocked<AnalyticsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchProfitLossUsecase,
        { provide: EntitlementService, useValue: { assertFeature: jest.fn().mockResolvedValue(undefined) } },
        { provide: AnalyticsRepository, useValue: { fetchProfitLossFigures: jest.fn() } },
      ],
    }).compile();
    usecase = module.get(FetchProfitLossUsecase);
    analyticsRepository = module.get(AnalyticsRepository);
  });

  const base = { sales: 0, tax: 0, refunds: 0, stockOpening: 0, stockClosing: 0, stockPurchases: 0, stockOut: 0, unpricedItems: 0, waste: 0, wasteUnpricedCount: 0, expenses: [] };

  it("costs the food as what left the shelves, then takes refunds, cost and spend off in order", async () => {
    analyticsRepository.fetchProfitLossFigures.mockResolvedValue({
      ...base,
      sales: 100_000,
      tax: 13_000,
      refunds: 5_000,
      stockOpening: 20_000,
      stockPurchases: 40_000,
      stockOut: 3_000,
      stockClosing: 27_000,
      waste: 2_000,
      expenses: [
        { category: "Rent", amount: 20_000 },
        { category: "Salaries", amount: 25_000 },
      ],
    });

    const result = await usecase.execute({ from, to, branchId }, authUser);

    // food = 20k + 40k − 3k − 27k = 30k; waste is inside it, not taken off again
    expect(result).toMatchObject({ revenue: 95_000, cogs: 30_000, grossProfit: 65_000, operatingExpenses: 45_000, netProfit: 20_000, tax: 13_000 });
    expect(result.netMargin).toBeCloseTo(20_000 / 95_000);
  });

  it("leaves the margin empty when nothing was sold", async () => {
    analyticsRepository.fetchProfitLossFigures.mockResolvedValue({ ...base, expenses: [{ category: "Rent", amount: 100 }] });

    const result = await usecase.execute({ from, to, branchId }, authUser);

    expect(result.netProfit).toBe(-100);
    expect(result.netMargin).toBeNull();
  });

  it("rejects a range that ends before it starts", async () => {
    await expect(usecase.execute({ from: to, to: from, branchId }, authUser)).rejects.toThrow();
    expect(analyticsRepository.fetchProfitLossFigures).not.toHaveBeenCalled();
  });
});
