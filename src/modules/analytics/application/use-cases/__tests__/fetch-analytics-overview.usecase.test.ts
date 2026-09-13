import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AnalyticsRepository } from "../../../domain/repositories/analytics.repository";
import { ANALYTICS_ERROR_MESSAGES, FetchAnalyticsOverviewUsecase } from "../fetch-analytics-overview.usecase";

const authUser = buildAuthEntity();

describe("FetchAnalyticsOverviewUsecase", () => {
  let usecase: FetchAnalyticsOverviewUsecase;
  let analyticsRepository: jest.Mocked<AnalyticsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchAnalyticsOverviewUsecase,
        {
          provide: AnalyticsRepository,
          useValue: {
            fetchOrderSummary: jest.fn().mockResolvedValue({ total: 12 }),
            fetchDishPerformance: jest.fn().mockResolvedValue([]),
            fetchFeedbackSummary: jest.fn().mockResolvedValue({ ratingCount: 0 }),
            fetchBusiestHours: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    usecase = module.get(FetchAnalyticsOverviewUsecase);
    analyticsRepository = module.get(AnalyticsRepository);
  });

  describe("execute", () => {
    it("should default to the trailing 30 days and scope to the token's restaurant", async () => {
      // Arrange & Act
      const result = await usecase.execute({}, authUser);

      // Assert
      const spanDays = (result.range.to.getTime() - result.range.from.getTime()) / (24 * 60 * 60 * 1000);
      expect(Math.round(spanDays)).toBe(30);
      expect(analyticsRepository.fetchOrderSummary).toHaveBeenCalledWith(authUser.restaurantId, result.range, expect.anything());
      expect(result.orders).toEqual({ total: 12 });
    });

    it("should honour an explicit range", async () => {
      // Arrange
      const from = new Date("2026-01-01T00:00:00.000Z");
      const to = new Date("2026-01-31T00:00:00.000Z");

      // Act
      const result = await usecase.execute({ from, to }, authUser);

      // Assert
      expect(result.range).toEqual({ from, to });
    });

    it("should throw BadRequestException when the range runs backwards", async () => {
      // Arrange
      const from = new Date("2026-02-01T00:00:00.000Z");
      const to = new Date("2026-01-01T00:00:00.000Z");

      // Act & Assert
      await expect(usecase.execute({ from, to }, authUser)).rejects.toThrow(
        new BadRequestException(ANALYTICS_ERROR_MESSAGES.INVALID_RANGE)
      );
      expect(analyticsRepository.fetchOrderSummary).not.toHaveBeenCalled();
    });
  });
});
