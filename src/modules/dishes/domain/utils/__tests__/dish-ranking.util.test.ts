import { EMPTY_DISH_STATS, IDishStats } from "../../interfaces/dish-stats.interface";
import { IDish } from "../../interfaces/dish.interface";
import { buildRankContext, confidenceScore, dishBadges, valueScore, velocityRatio } from "../dish-ranking.util";

const dish = { isFeatured: false } as IDish;

function buildStats(overrides: Partial<IDishStats> = {}): IDishStats {
  return { ...EMPTY_DISH_STATS, ...overrides };
}

describe("dish-ranking", () => {
  describe("buildRankContext", () => {
    it("should weight the restaurant mean by how many ratings each dish carries", () => {
      // Arrange
      const dishes = [
        { price: 1000, stats: buildStats({ avgRating: 5, ratingCount: 1 }) },
        { price: 2000, stats: buildStats({ avgRating: 4, ratingCount: 99 }) },
      ];

      // Act
      const context = buildRankContext(dishes);

      // Assert — the lone 5 barely moves it
      expect(context.restaurantMean).toBeCloseTo(4.01, 2);
      expect(context.maxPrice).toBe(2000);
    });

    it("should fall back to the prior when nothing has been rated yet", () => {
      // Arrange & Act
      const context = buildRankContext([{ price: 1000, stats: buildStats() }]);

      // Assert
      expect(context.restaurantMean).toBe(4);
    });
  });

  describe("confidenceScore", () => {
    it("should pull a thin five-star average back towards the restaurant mean", () => {
      // Arrange
      const thin = buildStats({ avgRating: 5, ratingCount: 2 });
      const proven = buildStats({ avgRating: 4.6, ratingCount: 300 });

      // Act & Assert
      expect(confidenceScore(thin, 4.2)).toBeLessThan(confidenceScore(proven, 4.2));
    });

    it("should sit an unrated dish just under the mean rather than at zero", () => {
      // Arrange & Act
      const score = confidenceScore(buildStats(), 4.4);

      // Assert
      expect(score).toBeCloseTo(3.96, 2);
    });
  });

  describe("velocityRatio", () => {
    it("should treat a dish with no previous window as doubled, not infinite", () => {
      // Arrange & Act
      const ratio = velocityRatio(buildStats({ orders30d: 12, ordersPrev30d: 0 }));

      // Assert — Infinity would not survive JSON serialisation
      expect(ratio).toBe(2);
      expect(Number.isFinite(ratio)).toBe(true);
    });

    it("should report a flat dish as unchanged", () => {
      // Arrange & Act & Assert
      expect(velocityRatio(buildStats({ orders30d: 40, ordersPrev30d: 40 }))).toBe(1);
    });
  });

  describe("valueScore", () => {
    it("should rank the cheaper of two equally rated dishes higher", () => {
      // Arrange
      const stats = buildStats({ avgRating: 4.6, ratingCount: 40 });
      const cheap = { price: 20000, stats };
      const dear = { price: 60000, stats };
      const context = buildRankContext([cheap, dear]);

      // Act & Assert
      expect(valueScore(cheap, context)).toBeGreaterThan(valueScore(dear, context));
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
