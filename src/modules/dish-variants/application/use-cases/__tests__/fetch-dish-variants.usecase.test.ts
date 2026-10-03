import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { DISH_ERROR_MESSAGES } from "../../../../dishes/domain/constants";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { DishVariantRepository } from "../../../domain/repositories/dish-variant.repository";
import { FetchDishVariantsUsecase } from "../fetch-dish-variants.usecase";

const authUser = buildAuthEntity();
const dish = { id: "dish-1", restaurantId: authUser.restaurantId, branchId: authUser.branchId, name: "BBQ Pizza" };
const variants = [
  { id: "variant-1", dishId: dish.id, name: "Small", isArchived: false },
  { id: "variant-2", dishId: dish.id, name: "Large", isArchived: true },
];

describe("FetchDishVariantsUsecase", () => {
  let usecase: FetchDishVariantsUsecase;
  let dishVariantRepository: jest.Mocked<DishVariantRepository>;
  let dishRepository: jest.Mocked<DishRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchDishVariantsUsecase,
        { provide: DishVariantRepository, useValue: { findByDishId: jest.fn() } },
        { provide: DishRepository, useValue: { findById: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(FetchDishVariantsUsecase);
    dishVariantRepository = module.get(DishVariantRepository);
    dishRepository = module.get(DishRepository);

    dishRepository.findById.mockResolvedValue(dish as any);
  });

  describe("execute", () => {
    it("should return every variant for the dish, live and archived alike", async () => {
      // Arrange
      dishVariantRepository.findByDishId.mockResolvedValue(variants as any);

      // Act
      const result = await usecase.execute(dish.id, authUser);

      // Assert
      expect(result).toEqual(variants);
      expect(dishVariantRepository.findByDishId).toHaveBeenCalledWith(dish.id);
    });

    it("should throw NotFoundException when the dish belongs to another restaurant", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue({ ...dish, restaurantId: "other" } as any);

      // Act & Assert
      await expect(usecase.execute(dish.id, authUser)).rejects.toThrow(new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND));
      expect(dishVariantRepository.findByDishId).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when there is no such dish", async () => {
      // Arrange
      dishRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute(dish.id, authUser)).rejects.toThrow(new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND));
    });
  });
});
