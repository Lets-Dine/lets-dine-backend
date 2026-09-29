import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { AddOnRepository } from "../../../../add-ons/domain/repositories/add-on.repository";
import { DishVariantRepository } from "../../../../dish-variants/domain/repositories/dish-variant.repository";
import { DISH_ERROR_MESSAGES } from "../../../domain/constants";
import { DishRepository } from "../../../domain/repositories/dish.repository";
import { FetchDishByIdUsecase } from "../fetch-dish-by-id.usecase";

describe("FetchDishByIdUsecase", () => {
  let usecase: FetchDishByIdUsecase;
  let dishRepository: jest.Mocked<DishRepository>;
  let addOnRepository: jest.Mocked<AddOnRepository>;
  let dishVariantRepository: jest.Mocked<DishVariantRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchDishByIdUsecase,
        { provide: DishRepository, useValue: { findAllWithStats: jest.fn() } },
        { provide: AddOnRepository, useValue: { findLinkedIdsByDishIds: jest.fn() } },
        { provide: DishVariantRepository, useValue: { findByDishId: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(FetchDishByIdUsecase);
    dishRepository = module.get(DishRepository);
    addOnRepository = module.get(AddOnRepository);
    dishVariantRepository = module.get(DishVariantRepository);
    addOnRepository.findLinkedIdsByDishIds.mockResolvedValue({});
    dishVariantRepository.findByDishId.mockResolvedValue([]);
  });

  describe("execute", () => {
    it("should return the dish with its stats and linked add-on ids attached", async () => {
      // Arrange
      const withStats = { id: "dish-1", isArchived: false, stats: {}, badges: [] } as any;
      dishRepository.findAllWithStats.mockResolvedValue([withStats]);
      addOnRepository.findLinkedIdsByDishIds.mockResolvedValue({ "dish-1": ["addon-1"] });

      // Act
      const result = await usecase.execute("dish-1");

      // Assert
      expect(result).toMatchObject({ id: "dish-1", addOnIds: ["addon-1"] });
      expect(dishRepository.findAllWithStats).toHaveBeenCalledWith({ ids: ["dish-1"] });
      expect(addOnRepository.findLinkedIdsByDishIds).toHaveBeenCalledWith(["dish-1"]);
    });

    it("should default to no linked add-ons when none are found", async () => {
      // Arrange
      const withStats = { id: "dish-1", isArchived: false, stats: {}, badges: [] } as any;
      dishRepository.findAllWithStats.mockResolvedValue([withStats]);
      addOnRepository.findLinkedIdsByDishIds.mockResolvedValue({});

      // Act
      const result = await usecase.execute("dish-1");

      // Assert
      expect(result.addOnIds).toEqual([]);
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
