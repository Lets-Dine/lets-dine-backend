import { EMPTY_DISH_STATS, IDishStats } from "../../interfaces/dish-stats.interface";
import { IDish } from "../../interfaces/dish.interface";
import { bayesianRating, dishBadges, velocityRatio } from "../dish-ranking.util";

const dish = { isFeatured: false } as IDish;

function buildStats(overrides: Partial<IDishStats> = {}): IDishStats {
  return { ...EMPTY_DISH_STATS, ...overrides };
}

describe("dish-ranking", () => {
  describe("bayesianRating", () => {
    it("should pull a thin five-star average back towards the prior", () => {
      // Arrange
      const thin = buildStats({ avgRating: 5, ratingCount: 2 });
      const proven = buildStats({ avgRating: 4.6, ratingCount: 300 });

      // Act & Assert
      expect(bayesianRating(thin)).toBeLessThan(bayesianRating(proven));
    });
  });

  describe("velocityRatio", () => {
    it("should treat a dish with no previous orders as newly selling", () => {
      // Arrange & Act
      const ratio = velocityRatio(buildStats({ orders30d: 12, ordersPrev30d: 0 }));

      // Assert
      expect(ratio).toBe(Number.POSITIVE_INFINITY);
    });
  });

  describe("dishBadges", () => {
    it("should award loved only once the evidence is thick enough", () => {
      // Arrange
      const thin = buildStats({ avgRating: 4.9, ratingCount: 3 });
      const thick = buildStats({ avgRating: 4.6, ratingCount: 40 });

      // Act & Assert
      expect(dishBadges(dish, thin)).not.toContain("loved");
      expect(dishBadges(dish, thick)).toContain("loved");
    });

    it("should mark a staff pick from the dish itself, not from its numbers", () => {
      // Arrange & Act
      const badges = dishBadges({ ...dish, isFeatured: true } as IDish, buildStats());

      // Assert
      expect(badges).toContain("pick");
    });

    it("should call a fast-rising dish trending", () => {
      // Arrange
      const stats = buildStats({ orders30d: 90, ordersPrev30d: 40 });

      // Act & Assert
      expect(dishBadges(dish, stats)).toContain("trending");
    });
  });
});
