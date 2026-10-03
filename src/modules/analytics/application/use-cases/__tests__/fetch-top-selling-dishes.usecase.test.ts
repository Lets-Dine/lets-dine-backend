import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { AnalyticsRepository } from "../../../domain/repositories/analytics.repository";
import { FetchTopSellingDishesUsecase, TOP_SELLING_DISHES_ERROR_MESSAGES } from "../fetch-top-selling-dishes.usecase";

const authUser = buildAuthEntity();

describe("FetchTopSellingDishesUsecase", () => {
  let usecase: FetchTopSellingDishesUsecase;
  let analyticsRepository: jest.Mocked<AnalyticsRepository>;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchTopSellingDishesUsecase,
        { provide: AnalyticsRepository, useValue: { fetchTopSellingDishes: jest.fn().mockResolvedValue([]) } },
        { provide: RestaurantRepository, useValue: { findById: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(FetchTopSellingDishesUsecase);
    analyticsRepository = module.get(AnalyticsRepository);
    restaurantRepository = module.get(RestaurantRepository);

    restaurantRepository.findById.mockResolvedValue({ timezone: "UTC" } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("execute", () => {
    it("returns everything up to now when neither date is given", async () => {
      // Arrange
      jest.useFakeTimers().setSystemTime(new Date("2026-01-20T12:00:00.000Z"));

      // Act
      await usecase.execute({}, authUser);

      // Assert
      expect(analyticsRepository.fetchTopSellingDishes).toHaveBeenCalledWith(authUser.restaurantId, {
        from: new Date(0),
        to: new Date("2026-01-20T12:00:00.000Z"),
      });
    });

    it("scopes to that one calendar day when only startDate is given", async () => {
      // Arrange
      restaurantRepository.findById.mockResolvedValue({ timezone: "Asia/Kathmandu" } as any);

      // Act
      await usecase.execute({ startDate: new Date("2026-01-15T10:00:00.000Z") }, authUser);

      // Assert — Kathmandu's Jan 15 runs from 18:15 UTC Jan 14 through 18:15 UTC Jan 15
      expect(analyticsRepository.fetchTopSellingDishes).toHaveBeenCalledWith(authUser.restaurantId, {
        from: new Date("2026-01-14T18:15:00.000Z"),
        to: new Date("2026-01-15T18:15:00.000Z"),
      });
    });

    it("scopes to the inclusive range when both dates are given", async () => {
      // Act
      await usecase.execute({ startDate: new Date("2026-01-10T00:00:00.000Z"), endDate: new Date("2026-01-12T00:00:00.000Z") }, authUser);

      // Assert — through the END of Jan 12, not its start
      expect(analyticsRepository.fetchTopSellingDishes).toHaveBeenCalledWith(authUser.restaurantId, {
        from: new Date("2026-01-10T00:00:00.000Z"),
        to: new Date("2026-01-13T00:00:00.000Z"),
      });
    });

    it("rejects an endDate given without a startDate", async () => {
      // Act & Assert
      await expect(usecase.execute({ endDate: new Date("2026-01-12T00:00:00.000Z") }, authUser)).rejects.toThrow(
        new BadRequestException(TOP_SELLING_DISHES_ERROR_MESSAGES.END_DATE_WITHOUT_START_DATE)
      );
      expect(analyticsRepository.fetchTopSellingDishes).not.toHaveBeenCalled();
    });

    it("rejects an endDate before startDate", async () => {
      // Act & Assert
      await expect(
        usecase.execute({ startDate: new Date("2026-01-12T00:00:00.000Z"), endDate: new Date("2026-01-10T00:00:00.000Z") }, authUser)
      ).rejects.toThrow(new BadRequestException(TOP_SELLING_DISHES_ERROR_MESSAGES.INVALID_RANGE));
    });

    it("returns whatever the repository resolves", async () => {
      // Arrange
      const dishes = [{ dishId: "d1", dishName: "Momo", orderCount: 5, totalAmount: 1000 }];
      analyticsRepository.fetchTopSellingDishes.mockResolvedValue(dishes);

      // Act
      const result = await usecase.execute({ startDate: new Date("2026-01-15T00:00:00.000Z") }, authUser);

      // Assert
      expect(result).toEqual(dishes);
    });
  });
});
