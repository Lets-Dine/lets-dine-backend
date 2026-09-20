import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { EMPTY_DISH_STATS, IDishStats } from "../../../../dishes/domain/interfaces/dish-stats.interface";
import { IDishWithStats } from "../../../../dishes/domain/interfaces/dish-with-stats.interface";
import { DishRepository } from "../../../../dishes/domain/repositories/dish.repository";
import { RESTAURANT_ERROR_MESSAGES } from "../../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../../restaurants/domain/repositories/restaurant.repository";
import { FetchMenuHighlightsUsecase } from "../fetch-menu-highlights.usecase";

function buildDish(id: string, stats: Partial<IDishStats>): IDishWithStats {
  return {
    id,
    restaurantId: "restaurant-1",
    categoryId: "category-1",
    name: id,
    slug: id,
    description: "",
    imageUrl: null,
    price: 40000,
    isAvailable: true,
    isArchived: false,
    isFeatured: false,
    sortOrder: 0,
    spiceLevel: 0,
    isVeg: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    stats: { ...EMPTY_DISH_STATS, ...stats },
    badges: [],
  };
}

describe("FetchMenuHighlightsUsecase", () => {
  let usecase: FetchMenuHighlightsUsecase;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;
  let dishRepository: jest.Mocked<DishRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FetchMenuHighlightsUsecase,
        { provide: RestaurantRepository, useValue: { findBySlug: jest.fn() } },
        { provide: DishRepository, useValue: { findAllWithStats: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(FetchMenuHighlightsUsecase);
    restaurantRepository = module.get(RestaurantRepository);
    dishRepository = module.get(DishRepository);
  });

  describe("execute", () => {
    it("should return the rails the menu's own dishes have earned", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue({ id: "restaurant-1", isActive: true } as any);
      dishRepository.findAllWithStats.mockResolvedValue([
        buildDish("loved-dish", { avgRating: 4.7, ratingCount: 40, orders30d: 120, ordersPrev30d: 115 }),
        buildDish("gem-dish", { avgRating: 4.8, ratingCount: 10, orders30d: 20, ordersPrev30d: 19 }),
      ]);

      // Act
      const rails = await usecase.execute("newa-kitchen");

      // Assert
      expect(rails.map(rail => rail.key)).toEqual(expect.arrayContaining(["loved", "gem"]));
      expect(rails.find(rail => rail.key === "loved")?.title).toBe("Most loved here");
      expect(dishRepository.findAllWithStats).toHaveBeenCalledWith({ restaurantId: "restaurant-1", isArchived: false });
    });

    it("should return only the sections asked for", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue({ id: "restaurant-1", isActive: true } as any);
      dishRepository.findAllWithStats.mockResolvedValue([
        buildDish("loved-dish", { avgRating: 4.7, ratingCount: 40, orders30d: 120, ordersPrev30d: 115 }),
        buildDish("gem-dish", { avgRating: 4.8, ratingCount: 10, orders30d: 20, ordersPrev30d: 19 }),
      ]);

      // Act
      const rails = await usecase.execute("newa-kitchen", { sections: ["gem"] });

      // Assert
      expect(rails.map(rail => rail.key)).toEqual(["gem"]);
    });

    it("should answer with nothing rather than a claim when the evidence is thin", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue({ id: "restaurant-1", isActive: true } as any);
      dishRepository.findAllWithStats.mockResolvedValue([buildDish("new-dish", { avgRating: 5, ratingCount: 1 })]);

      // Act
      const rails = await usecase.execute("newa-kitchen");

      // Assert
      expect(rails).toEqual([]);
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
