import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { RESTAURANT_ERROR_MESSAGES } from "../../../domain/constants";
import { RestaurantRepository } from "../../../domain/repositories/restaurant.repository";
import { FetchRestaurantBySlugUsecase } from "../fetch-restaurant-by-slug.usecase";

describe("FetchRestaurantBySlugUsecase", () => {
  let usecase: FetchRestaurantBySlugUsecase;
  let restaurantRepository: jest.Mocked<RestaurantRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FetchRestaurantBySlugUsecase, { provide: RestaurantRepository, useValue: { findBySlug: jest.fn() } }],
    }).compile();

    usecase = module.get(FetchRestaurantBySlugUsecase);
    restaurantRepository = module.get(RestaurantRepository);
  });

  describe("execute", () => {
    it("should return the restaurant behind the slug", async () => {
      // Arrange
      const restaurant = { id: "restaurant-1", isActive: true } as any;
      restaurantRepository.findBySlug.mockResolvedValue(restaurant);

      // Act
      const result = await usecase.execute("newa-kitchen");

      // Assert
      expect(result).toBe(restaurant);
    });

    it("should throw NotFoundException when the slug is unknown", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("nope")).rejects.toThrow(new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND));
    });

    it("should throw NotFoundException when the restaurant is deactivated", async () => {
      // Arrange
      restaurantRepository.findBySlug.mockResolvedValue({ id: "restaurant-1", isActive: false } as any);

      // Act & Assert
      await expect(usecase.execute("newa-kitchen")).rejects.toThrow(new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND));
    });
  });
});
