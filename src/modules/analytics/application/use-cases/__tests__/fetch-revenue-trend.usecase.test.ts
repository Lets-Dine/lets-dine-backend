import { Test, TestingModule } from "@nestjs/testing";
import { EntitlementService } from "../../../../billing/application/entitlement.service";
import { buildAuthEntity } from "../../../../../common/testing";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { AnalyticsRepository } from "../../../domain/repositories/analytics.repository";
import { FetchRevenueTrendUsecase } from "../fetch-revenue-trend.usecase";

const authUser = buildAuthEntity();

describe("FetchRevenueTrendUsecase", () => {
  let usecase: FetchRevenueTrendUsecase;
  let analyticsRepository: jest.Mocked<AnalyticsRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchRevenueTrendUsecase,
        { provide: EntitlementService, useValue: { assertFeature: jest.fn().mockResolvedValue(undefined) } },
        { provide: AnalyticsRepository, useValue: { fetchRevenueByBucket: jest.fn().mockResolvedValue([]) } },
        { provide: RestaurantRepository, useValue: { findById: jest.fn().mockResolvedValue({ timezone: "UTC" }) } },
      ],
    }).compile();

    usecase = module.get(FetchRevenueTrendUsecase);
    analyticsRepository = module.get(AnalyticsRepository);
    restaurantRepository = module.get(RestaurantRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("execute", () => {
    it("lays a week out Sunday to Saturday against the week before, with days still to come left empty", async () => {
      // Arrange — Wednesday 2026-01-14; this week began Sunday the 11th
      jest.useFakeTimers().setSystemTime(new Date("2026-01-14T10:30:00.000Z"));
      analyticsRepository.fetchRevenueByBucket.mockResolvedValue([
        { key: "2026-01-04", revenue: 800 },
        { key: "2026-01-07", revenue: 400 },
        { key: "2026-01-11", revenue: 1000 },
        { key: "2026-01-13", revenue: 500 },
      ]);

      // Act
      const result = await usecase.execute("week", authUser);

      // Assert
      expect(analyticsRepository.fetchRevenueByBucket).toHaveBeenCalledWith(
        { restaurantId: authUser.restaurantId },
        { from: new Date("2026-01-04T00:00:00.000Z"), to: new Date("2026-01-18T00:00:00.000Z") },
        "day",
        "UTC"
      );
      expect(result.granularity).toBe("day");
      expect(result.points).toHaveLength(7);
      expect(result.points[0]).toEqual({ index: 0, date: "2026-01-11", current: 1000, previousDate: "2026-01-04", previous: 800 });
      expect(result.points[1].current).toBe(0);
      expect(result.points[3]).toMatchObject({ date: "2026-01-14", current: 0, previous: 400 });
      expect(result.points[4].current).toBeNull();
      expect(result.points[6].previous).toBe(0);
      expect(result.currentTotal).toBe(1500);
      expect(result.previousTotal).toBe(1200);
      // Sun–Wed of last week only, not all of it
      expect(result.previousToDate).toBe(1200);
      expect(result.differencePercentage).toBe(25);
    });

    it("measures the change against the same stretch of the previous week, not all of it", async () => {
      // Arrange — Monday: this week has two days, so last week's Saturday must not drag the comparison down
      jest.useFakeTimers().setSystemTime(new Date("2026-01-12T10:00:00.000Z"));
      analyticsRepository.fetchRevenueByBucket.mockResolvedValue([
        { key: "2026-01-04", revenue: 100 },
        { key: "2026-01-05", revenue: 100 },
        { key: "2026-01-10", revenue: 9000 },
        { key: "2026-01-11", revenue: 150 },
        { key: "2026-01-12", revenue: 150 },
      ]);

      // Act
      const result = await usecase.execute("week", authUser);

      // Assert
      expect(result.previousTotal).toBe(9200);
      expect(result.previousToDate).toBe(200);
      expect(result.differencePercentage).toBe(50);
    });

    it("gives a month one slot per day and nulls the previous side where the previous month is shorter", async () => {
      // Arrange — 2026-03-30; February has 28 days, March 31
      jest.useFakeTimers().setSystemTime(new Date("2026-03-30T12:00:00.000Z"));

      // Act
      const result = await usecase.execute("month", authUser);

      // Assert
      expect(analyticsRepository.fetchRevenueByBucket).toHaveBeenCalledWith(
        { restaurantId: authUser.restaurantId },
        { from: new Date("2026-02-01T00:00:00.000Z"), to: new Date("2026-04-01T00:00:00.000Z") },
        "day",
        "UTC"
      );
      expect(result.points).toHaveLength(31);
      expect(result.points[27]).toMatchObject({ date: "2026-03-28", previousDate: "2026-02-28" });
      expect(result.points[28]).toMatchObject({ date: "2026-03-29", previousDate: null, previous: null });
      expect(result.points[29].current).toBe(0);
      expect(result.points[30].current).toBeNull();
    });

    it("gives a year one slot per month against the year before", async () => {
      // Arrange — mid-April 2026
      jest.useFakeTimers().setSystemTime(new Date("2026-04-15T12:00:00.000Z"));
      analyticsRepository.fetchRevenueByBucket.mockResolvedValue([
        { key: "2025-01", revenue: 1000 },
        { key: "2025-04", revenue: 3000 },
        { key: "2025-09", revenue: 5000 },
        { key: "2026-01", revenue: 1500 },
        { key: "2026-04", revenue: 2000 },
      ]);

      // Act
      const result = await usecase.execute("year", authUser);

      // Assert
      expect(analyticsRepository.fetchRevenueByBucket).toHaveBeenCalledWith(
        { restaurantId: authUser.restaurantId },
        { from: new Date("2025-01-01T00:00:00.000Z"), to: new Date("2027-01-01T00:00:00.000Z") },
        "month",
        "UTC"
      );
      expect(result.granularity).toBe("month");
      expect(result.points).toHaveLength(12);
      expect(result.points[0]).toEqual({ index: 0, date: "2026-01", current: 1500, previousDate: "2025-01", previous: 1000 });
      expect(result.points[3].current).toBe(2000);
      expect(result.points[4].current).toBeNull();
      expect(result.points[8].previous).toBe(5000);
      expect(result.currentTotal).toBe(3500);
      expect(result.previousToDate).toBe(4000);
      expect(result.differencePercentage).toBe(-12.5);
    });

    it("reads the week in the restaurant's own timezone", async () => {
      // Arrange — 2026-01-17 20:00 UTC is already Sunday 2026-01-18 01:45 in Kathmandu (UTC+5:45)
      restaurantRepository.findById.mockResolvedValue({ timezone: "Asia/Kathmandu" } as any);
      jest.useFakeTimers().setSystemTime(new Date("2026-01-17T20:00:00.000Z"));

      // Act
      const result = await usecase.execute("week", authUser);

      // Assert — a new week has just begun there; the scan starts at last Sunday's local midnight (18:15 UTC the day before)
      expect(analyticsRepository.fetchRevenueByBucket).toHaveBeenCalledWith(
        { restaurantId: authUser.restaurantId },
        { from: new Date("2026-01-10T18:15:00.000Z"), to: new Date("2026-01-24T18:15:00.000Z") },
        "day",
        "Asia/Kathmandu"
      );
      expect(result.points[0].date).toBe("2026-01-18");
      expect(result.points[1].current).toBeNull();
    });

    it("reports no change when neither period took any money", async () => {
      // Arrange
      jest.useFakeTimers().setSystemTime(new Date("2026-01-14T10:30:00.000Z"));

      // Act
      const result = await usecase.execute("week", authUser);

      // Assert
      expect(result.currentTotal).toBe(0);
      expect(result.differencePercentage).toBe(0);
    });

    it("narrows to one branch when asked", async () => {
      // Arrange
      const branchId = authUser.branchIds === "all" ? "5f1c2a3e-8a3b-4c52-9a11-0d6f6a5b7c21" : authUser.branchIds[0];

      // Act
      await usecase.execute("week", authUser, branchId);

      // Assert
      expect(analyticsRepository.fetchRevenueByBucket.mock.calls[0][0]).toEqual({
        restaurantId: authUser.restaurantId,
        branchIds: [branchId],
      });
    });
  });
});
