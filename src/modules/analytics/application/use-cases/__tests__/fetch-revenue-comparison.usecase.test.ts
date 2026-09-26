import { Test, TestingModule } from "@nestjs/testing";
import { buildAuthEntity } from "../../../../../common/testing";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { AnalyticsRepository } from "../../../domain/repositories/analytics.repository";
import { FetchRevenueComparisonUsecase } from "../fetch-revenue-comparison.usecase";

const authUser = buildAuthEntity();

describe("FetchRevenueComparisonUsecase", () => {
  let usecase: FetchRevenueComparisonUsecase;
  let analyticsRepository: jest.Mocked<AnalyticsRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchRevenueComparisonUsecase,
        {
          provide: AnalyticsRepository,
          useValue: {
            fetchRevenueComparison: jest.fn().mockResolvedValue({ current: 0, previous: 0 }),
          },
        },
        { provide: RestaurantRepository, useValue: { findById: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(FetchRevenueComparisonUsecase);
    analyticsRepository = module.get(AnalyticsRepository);
    restaurantRepository = module.get(RestaurantRepository);

    // Every existing test below assumes a UTC restaurant, so the boundaries
    // it asserts on stay the same as before this usecase went timezone-aware.
    restaurantRepository.findById.mockResolvedValue({ timezone: "UTC" } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("execute", () => {
    it("compares today-so-far against the whole of yesterday", async () => {
      // Arrange — Wednesday 2026-01-14 10:30 UTC
      jest.useFakeTimers().setSystemTime(new Date("2026-01-14T10:30:00.000Z"));
      analyticsRepository.fetchRevenueComparison.mockResolvedValue({ current: 1500, previous: 1000 });

      // Act
      const result = await usecase.execute("today", authUser);

      // Assert
      expect(analyticsRepository.fetchRevenueComparison).toHaveBeenCalledWith(
        authUser.restaurantId,
        { from: new Date("2026-01-14T00:00:00.000Z"), to: new Date("2026-01-14T10:30:00.000Z") },
        { from: new Date("2026-01-13T00:00:00.000Z"), to: new Date("2026-01-14T00:00:00.000Z") }
      );
      expect(result).toEqual({ current: 1500, previous: 1000, differencePercentage: 50 });
    });

    it("weeks start on Sunday", async () => {
      // Arrange — Wednesday 2026-01-14
      jest.useFakeTimers().setSystemTime(new Date("2026-01-14T10:30:00.000Z"));

      // Act
      await usecase.execute("week", authUser);

      // Assert — the full previous week, ending exactly where this week begins
      expect(analyticsRepository.fetchRevenueComparison).toHaveBeenCalledWith(
        authUser.restaurantId,
        { from: new Date("2026-01-11T00:00:00.000Z"), to: new Date("2026-01-14T10:30:00.000Z") },
        { from: new Date("2026-01-04T00:00:00.000Z"), to: new Date("2026-01-11T00:00:00.000Z") }
      );
    });

    it("compares against the whole previous month, regardless of the two months' differing lengths", async () => {
      // Arrange — 2026-03-30, so the previous month (February, 28 days) is shorter than March-so-far
      jest.useFakeTimers().setSystemTime(new Date("2026-03-30T12:00:00.000Z"));

      // Act
      await usecase.execute("month", authUser);

      // Assert
      expect(analyticsRepository.fetchRevenueComparison).toHaveBeenCalledWith(
        authUser.restaurantId,
        { from: new Date("2026-03-01T00:00:00.000Z"), to: new Date("2026-03-30T12:00:00.000Z") },
        { from: new Date("2026-02-01T00:00:00.000Z"), to: new Date("2026-03-01T00:00:00.000Z") }
      );
    });

    it("uses the restaurant's own timezone, not UTC, to decide where a day starts", async () => {
      // Arrange — 2026-01-14 20:00 UTC is already 2026-01-15 01:45 in Kathmandu (UTC+5:45)
      restaurantRepository.findById.mockResolvedValue({ timezone: "Asia/Kathmandu" } as any);
      jest.useFakeTimers().setSystemTime(new Date("2026-01-14T20:00:00.000Z"));

      // Act
      await usecase.execute("today", authUser);

      // Assert — "today" is Kathmandu's Jan 15, which starts at 18:15 UTC on Jan 14, not midnight UTC;
      // "previous" is the whole of Kathmandu's Jan 14, i.e. 18:15 UTC Jan 13 through 18:15 UTC Jan 14.
      expect(analyticsRepository.fetchRevenueComparison).toHaveBeenCalledWith(
        authUser.restaurantId,
        { from: new Date("2026-01-14T18:15:00.000Z"), to: new Date("2026-01-14T20:00:00.000Z") },
        { from: new Date("2026-01-13T18:15:00.000Z"), to: new Date("2026-01-14T18:15:00.000Z") }
      );
    });

    it("carries the restaurant's timezone offset through a month boundary too", async () => {
      // Arrange — 2026-02-28 19:00 UTC is already 2026-03-01 00:45 in Kathmandu
      restaurantRepository.findById.mockResolvedValue({ timezone: "Asia/Kathmandu" } as any);
      jest.useFakeTimers().setSystemTime(new Date("2026-02-28T19:00:00.000Z"));

      // Act
      await usecase.execute("month", authUser);

      // Assert — March (Kathmandu) started 18:15 UTC on Feb 28; the whole of February (Kathmandu)
      // ran from 18:15 UTC on Jan 31 through 18:15 UTC on Feb 28.
      expect(analyticsRepository.fetchRevenueComparison).toHaveBeenCalledWith(
        authUser.restaurantId,
        { from: new Date("2026-02-28T18:15:00.000Z"), to: new Date("2026-02-28T19:00:00.000Z") },
        { from: new Date("2026-01-31T18:15:00.000Z"), to: new Date("2026-02-28T18:15:00.000Z") }
      );
    });

    it("returns a 100% increase when the previous period had no revenue", async () => {
      // Arrange
      analyticsRepository.fetchRevenueComparison.mockResolvedValue({ current: 500, previous: 0 });

      // Act
      const result = await usecase.execute("today", authUser);

      // Assert
      expect(result.differencePercentage).toBe(100);
    });

    it("returns 0% when both periods had no revenue", async () => {
      // Arrange
      analyticsRepository.fetchRevenueComparison.mockResolvedValue({ current: 0, previous: 0 });

      // Act
      const result = await usecase.execute("today", authUser);

      // Assert
      expect(result.differencePercentage).toBe(0);
    });
  });
});
