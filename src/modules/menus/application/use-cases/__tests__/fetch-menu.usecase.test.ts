import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchMenuUsecase,
        { provide: RestaurantRepository, useValue: { findBySlug: jest.fn() } },
        { provide: RestaurantRatingRepository, useValue: { fetchRating: jest.fn() } },
        { provide: MenuCategoryRepository, useValue: { fetchAll: jest.fn() } },
        { provide: DishRepository, useValue: { findAllWithStats: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(FetchMenuUsecase);
    restaurantRepository = module.get(RestaurantRepository);
    restaurantRatingRepository = module.get(RestaurantRatingRepository);
    menuCategoryRepository = module.get(MenuCategoryRepository);
    dishRepository = module.get(DishRepository);
  });

  describe("execute", () => {
    it("should compose restaurant, rating, categories and dishes into one menu", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue({ id: "restaurant-1", isActive: true } as any);
      restaurantRatingRepository.fetchRating.mockResolvedValue({ avgRating: 4.6, ratingCount: 210 });
      menuCategoryRepository.fetchAll.mockResolvedValue({ rows: [{ id: "category-1" } as any], count: 1 });
      dishRepository.findAllWithStats.mockResolvedValue([{ id: "dish-1", stats: {}, badges: [] } as any]);

      // Act
      const result = await usecase.execute("newa-kitchen");

      // Assert
      expect(result.restaurant).toMatchObject({ id: "restaurant-1", avgRating: 4.6, ratingCount: 210 });
      expect(result.categories).toHaveLength(1);
      expect(result.dishes).toHaveLength(1);
      expect(dishRepository.findAllWithStats).toHaveBeenCalledWith({ restaurantId: "restaurant-1", isArchived: false });
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
