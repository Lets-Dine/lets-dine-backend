import { Test } from "@nestjs/testing";
import { ForbiddenException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { EntitlementService } from "../../../../billing/application/entitlement.service";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { AnalyticsRepository } from "../../../domain/repositories/analytics.repository";
import { FetchBranchPerformanceUsecase } from "../fetch-branch-performance.usecase";
import { FetchOrderComparisonUsecase } from "../fetch-order-comparison.usecase";
import { FetchRevenueComparisonUsecase } from "../fetch-revenue-comparison.usecase";
import { FetchRevenueTrendUsecase } from "../fetch-revenue-trend.usecase";

const authUser = buildAuthEntity();
const locked = new ForbiddenException({ key: "FEATURE_LOCKED", message: "locked" });

/** The trend, comparison and per-branch views are the paid analytics tier; this pins that every one of them asks. */
describe("premium analytics feature gate", () => {
  let entitlementService: { assertFeature: jest.Mock };
  let analyticsRepository: Record<string, jest.Mock>;
  let moduleRef: Awaited<ReturnType<typeof buildModule>>;

  async function buildModule() {
    entitlementService = { assertFeature: jest.fn().mockResolvedValue(undefined) };
    analyticsRepository = {
      fetchRevenueByBucket: jest.fn().mockResolvedValue([]),
      fetchRevenueComparison: jest.fn().mockResolvedValue({ current: 0, previous: 0 }),
      fetchOrderComparison: jest.fn().mockResolvedValue({ current: 0, previous: 0 }),
      fetchBranchPerformance: jest.fn().mockResolvedValue([]),
    };

    return Test.createTestingModule({
      providers: [
        FetchRevenueTrendUsecase,
        FetchRevenueComparisonUsecase,
        FetchOrderComparisonUsecase,
        FetchBranchPerformanceUsecase,
        { provide: EntitlementService, useValue: entitlementService },
        { provide: AnalyticsRepository, useValue: analyticsRepository },
        { provide: RestaurantRepository, useValue: { findById: jest.fn().mockResolvedValue({ timezone: "UTC" }) } },
      ],
    }).compile();
  }

  beforeEach(async () => {
    moduleRef = await buildModule();
  });

  const cases: [string, (m: typeof moduleRef) => Promise<unknown>][] = [
    ["revenue trend", m => m.get(FetchRevenueTrendUsecase).execute("week", authUser)],
    ["revenue comparison", m => m.get(FetchRevenueComparisonUsecase).execute("today", authUser)],
    ["order comparison", m => m.get(FetchOrderComparisonUsecase).execute("today", authUser)],
    ["branch performance", m => m.get(FetchBranchPerformanceUsecase).execute({}, authUser)],
  ];

  it.each(cases)("should ask for the full analytics tier of the token's restaurant before serving %s", async (_name, run) => {
    // Act
    await run(moduleRef);

    // Assert
    expect(entitlementService.assertFeature).toHaveBeenCalledWith(authUser.restaurantId, "analyticsFull");
  });

  it.each(cases)("should serve nothing for %s when the plan does not include it", async (_name, run) => {
    // Arrange
    entitlementService.assertFeature.mockRejectedValue(locked);

    // Act & Assert
    await expect(run(moduleRef)).rejects.toBe(locked);
    for (const method of Object.values(analyticsRepository)) expect(method).not.toHaveBeenCalled();
  });
});
