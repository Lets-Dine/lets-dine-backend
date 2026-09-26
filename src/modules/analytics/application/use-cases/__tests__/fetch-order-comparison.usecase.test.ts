import { Test, TestingModule } from "@nestjs/testing";
import { buildAuthEntity } from "../../../../../common/testing";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { AnalyticsRepository } from "../../../domain/repositories/analytics.repository";
import { FetchOrderComparisonUsecase } from "../fetch-order-comparison.usecase";

const authUser = buildAuthEntity();

describe("FetchOrderComparisonUsecase", () => {
  let usecase: FetchOrderComparisonUsecase;
  let analyticsRepository: jest.Mocked<AnalyticsRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchOrderComparisonUsecase,
        {
          provide: AnalyticsRepository,
          useValue: {
            fetchOrderComparison: jest.fn().mockResolvedValue({ current: 0, previous: 0 }),
          },
        },
        { provide: RestaurantRepository, useValue: { findById: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(FetchOrderComparisonUsecase);
    analyticsRepository = module.get(AnalyticsRepository);
    restaurantRepository = module.get(RestaurantRepository);

    restaurantRepository.findById.mockResolvedValue({ timezone: "UTC" } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("execute", () => {
    it("compares today-so-far's order count against the whole of yesterday", async () => {
      // Arrange — Wednesday 2026-01-14 10:30 UTC
      jest.useFakeTimers().setSystemTime(new Date("2026-01-14T10:30:00.000Z"));
      analyticsRepository.fetchOrderComparison.mockResolvedValue({ current: 15, previous: 10 });

      // Act
      const result = await usecase.execute("today", authUser);

      // Assert
      expect(analyticsRepository.fetchOrderComparison).toHaveBeenCalledWith(
        authUser.restaurantId,
        { from: new Date("2026-01-14T00:00:00.000Z"), to: new Date("2026-01-14T10:30:00.000Z") },
        { from: new Date("2026-01-13T00:00:00.000Z"), to: new Date("2026-01-14T00:00:00.000Z") }
      );
      expect(result).toEqual({ current: 15, previous: 10, differencePercentage: 50 });
    });

    it("falls back to UTC when the restaurant has no timezone on record", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue(null);
      jest.useFakeTimers().setSystemTime(new Date("2026-01-14T10:30:00.000Z"));

      // Act
      await usecase.execute("today", authUser);

      // Assert
      expect(analyticsRepository.fetchOrderComparison).toHaveBeenCalledWith(
        authUser.restaurantId,
        { from: new Date("2026-01-14T00:00:00.000Z"), to: new Date("2026-01-14T10:30:00.000Z") },
        { from: new Date("2026-01-13T00:00:00.000Z"), to: new Date("2026-01-14T00:00:00.000Z") }
      );
    });

    it("returns a 100% increase when the previous period had no orders", async () => {
      // Arrange
      analyticsRepository.fetchOrderComparison.mockResolvedValue({ current: 5, previous: 0 });

      // Act
      const result = await usecase.execute("today", authUser);

      // Assert
      expect(result.differencePercentage).toBe(100);
    });

    it("returns 0% when both periods had no orders", async () => {
      // Arrange
      analyticsRepository.fetchOrderComparison.mockResolvedValue({ current: 0, previous: 0 });

      // Act
      const result = await usecase.execute("today", authUser);

      // Assert
      expect(result.differencePercentage).toBe(0);
    });
  });
});
