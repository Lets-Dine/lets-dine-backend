import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { DISH_ERROR_MESSAGES } from "../../../domain/constants";
import { DishRepository } from "../../../domain/repositories/dish.repository";
import { FetchDishByIdUsecase } from "../fetch-dish-by-id.usecase";

describe("FetchDishByIdUsecase", () => {
  let usecase: FetchDishByIdUsecase;
  let dishRepository: jest.Mocked<DishRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FetchDishByIdUsecase, { provide: DishRepository, useValue: { findAllWithStats: jest.fn() } }],
    }).compile();

    usecase = module.get(FetchDishByIdUsecase);
    dishRepository = module.get(DishRepository);
  });

  describe("execute", () => {
    it("should return the dish with its stats attached", async () => {
      // Arrange
      const withStats = { id: "dish-1", isArchived: false, stats: {}, badges: [] } as any;
      dishRepository.findAllWithStats.mockResolvedValue([withStats]);

      // Act
      const result = await usecase.execute("dish-1");

      // Assert
      expect(result).toBe(withStats);
      expect(dishRepository.findAllWithStats).toHaveBeenCalledWith({ ids: ["dish-1"] });
    });

    it("should hide an archived dish from the public lookup", async () => {
      // Arrange
      dishRepository.findAllWithStats.mockResolvedValue([{ id: "dish-1", isArchived: true, stats: {}, badges: [] } as any]);

      // Act & Assert
      await expect(usecase.execute("dish-1")).rejects.toThrow(new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND));
    });

    it("should still return an archived dish for the dashboard", async () => {
      // Arrange
      dishRepository.findAllWithStats.mockResolvedValue([{ id: "dish-1", isArchived: true, stats: {}, badges: [] } as any]);

      // Act
      const result = await usecase.execute("dish-1", { includeArchived: true });

      // Assert
      expect(result.id).toBe("dish-1");
    });

    it("should throw NotFoundException when there is no such dish", async () => {
      // Arrange
      dishRepository.findAllWithStats.mockResolvedValue([]);

      // Act & Assert
      await expect(usecase.execute("dish-1")).rejects.toThrow(new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND));
    });
  });
});
