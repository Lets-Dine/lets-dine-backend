import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { DISH_ERROR_MESSAGES } from "../../../domain/constants";
import { DishRepository } from "../../../domain/repositories/dish.repository";
import { DishStatsService } from "../../dish-stats.service";
import { FetchDishByIdUsecase } from "../fetch-dish-by-id.usecase";

describe("FetchDishByIdUsecase", () => {
  let usecase: FetchDishByIdUsecase;
  let dishRepository: jest.Mocked<DishRepository>;
  let dishStatsService: jest.Mocked<DishStatsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchDishByIdUsecase,
        { provide: DishRepository, useValue: { findById: jest.fn() } },
        { provide: DishStatsService, useValue: { attachOne: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(FetchDishByIdUsecase);
    dishRepository = module.get(DishRepository);
    dishStatsService = module.get(DishStatsService);
  });

  describe("execute", () => {
    it("should return the dish with its stats attached", async () => {
      // Arrange
      const dish = { id: "dish-1", isArchived: false } as any;
      const withStats = { ...dish, stats: {}, badges: [] };
      dishRepository.findById.mockResolvedValue(dish);
      dishStatsService.attachOne.mockResolvedValue(withStats);

      // Act
      const result = await usecase.execute("dish-1");

      // Assert
      expect(result).toBe(withStats);
    });

    it("should hide an archived dish from the public lookup", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue({ id: "dish-1", isArchived: true } as any);

      // Act & Assert
      await expect(usecase.execute("dish-1")).rejects.toThrow(new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND));
    });

    it("should still return an archived dish for the dashboard", async () => {
      // Arrange
      const dish = { id: "dish-1", isArchived: true } as any;
      dishRepository.findById.mockResolvedValue(dish);
      dishStatsService.attachOne.mockResolvedValue({ ...dish, stats: {}, badges: [] });

      // Act
      const result = await usecase.execute("dish-1", { includeArchived: true });

      // Assert
      expect(result.id).toBe("dish-1");
    });

    it("should throw NotFoundException when there is no such dish", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("dish-1")).rejects.toThrow(new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND));
    });
  });
});
