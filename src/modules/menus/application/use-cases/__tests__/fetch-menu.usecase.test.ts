import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { AddOnRepository } from "../../../../add-ons/domain/repositories/add-on.repository";
import { DishVariantRepository } from "../../../../dish-variants/domain/repositories/dish-variant.repository";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { MenuCategoryRepository } from "../../../../menu-categories/domain/repositories/menu-category.repository";
import { RESTAURANT_ERROR_MESSAGES } from "../../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { RestaurantRatingRepository } from "../../../domain/repositories/restaurant-rating.repository";
import { FetchMenuUsecase } from "../fetch-menu.usecase";

describe("FetchMenuUsecase", () => {
  let usecase: FetchMenuUsecase;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let restaurantRatingRepository: jest.Mocked<RestaurantRatingRepository>;
  let menuCategoryRepository: jest.Mocked<MenuCategoryRepository>;
  let dishRepository: jest.Mocked<DishRepository>;
  let addOnRepository: jest.Mocked<AddOnRepository>;
  let dishVariantRepository: jest.Mocked<DishVariantRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchMenuUsecase,
        { provide: RestaurantRepository, useValue: { findBySlug: jest.fn() } },
        { provide: RestaurantRatingRepository, useValue: { fetchRating: jest.fn() } },
        { provide: MenuCategoryRepository, useValue: { fetchAll: jest.fn() } },
        { provide: DishRepository, useValue: { findAllWithStats: jest.fn() } },
        { provide: AddOnRepository, useValue: { fetchAll: jest.fn(), findLinkedIdsByDishIds: jest.fn() } },
        { provide: DishVariantRepository, useValue: { findManyByDishIds: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(FetchMenuUsecase);
    restaurantRepository = module.get(RestaurantRepository);
    restaurantRatingRepository = module.get(RestaurantRatingRepository);
    menuCategoryRepository = module.get(MenuCategoryRepository);
    dishRepository = module.get(DishRepository);
    addOnRepository = module.get(AddOnRepository);
    dishVariantRepository = module.get(DishVariantRepository);
    addOnRepository.fetchAll.mockResolvedValue({ rows: [], count: 0 });
    addOnRepository.findLinkedIdsByDishIds.mockResolvedValue({});
    dishVariantRepository.findManyByDishIds.mockResolvedValue({});
  });

  describe("execute", () => {
    it("should compose restaurant, rating, categories, dishes and add-ons into one menu", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue({ id: "restaurant-1", isActive: true } as any);
      restaurantRatingRepository.fetchRating.mockResolvedValue({ avgRating: 4.6, ratingCount: 210 });
      menuCategoryRepository.fetchAll.mockResolvedValue({ rows: [{ id: "category-1" } as any], count: 1 });
      dishRepository.findAllWithStats.mockResolvedValue([{ id: "dish-1", stats: {}, badges: [], addOnIds: [] } as any]);
      addOnRepository.fetchAll.mockResolvedValue({ rows: [{ id: "addon-1" } as any], count: 1 });
      addOnRepository.findLinkedIdsByDishIds.mockResolvedValue({ "dish-1": ["addon-1"] });

      // Act
      const result = await usecase.execute("newa-kitchen");

      // Assert
      expect(result.restaurant).toMatchObject({ id: "restaurant-1", avgRating: 4.6, ratingCount: 210 });
      expect(result.categories).toHaveLength(1);
      expect(result.dishes).toEqual([{ id: "dish-1", stats: {}, badges: [], addOnIds: ["addon-1"], variants: [] }]);
      expect(result.addOns).toEqual([{ id: "addon-1" }]);
      expect(dishRepository.findAllWithStats).toHaveBeenCalledWith({ restaurantId: "restaurant-1", isArchived: false });
      expect(addOnRepository.fetchAll).toHaveBeenCalledWith({ restaurantId: "restaurant-1", isArchived: false });
    });

    it("should throw NotFoundException for an unknown or closed restaurant", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("nope")).rejects.toThrow(new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND));
      expect(dishRepository.findAllWithStats).not.toHaveBeenCalled();
    });
  });
});
