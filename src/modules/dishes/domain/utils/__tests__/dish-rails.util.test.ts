import { EMPTY_DISH_STATS, IDishStats } from "../../interfaces/dish-stats.interface";
import { IDishWithStats } from "../../interfaces/dish-with-stats.interface";
import { buildDishRails } from "../dish-rails.util";

function buildDish(id: string, price: number, stats: Partial<IDishStats>, overrides: Partial<IDishWithStats> = {}): IDishWithStats {
  return {
    id,
    restaurantId: "restaurant-1",
    categoryId: "category-1",
    name: id,
    slug: id,
    description: "",
    imageUrl: null,
    price,
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
    ...overrides,
  };
}

/** One dish per claim, each sitting just over its own threshold. */
const loved = buildDish("loved-dish", 45000, { avgRating: 4.7, ratingCount: 40, orders30d: 120, ordersPrev30d: 118 });
const trending = buildDish("trending-dish", 30000, { avgRating: 4.1, ratingCount: 6, orders30d: 80, ordersPrev30d: 30 });
const gem = buildDish("gem-dish", 39000, { avgRating: 4.8, ratingCount: 10, orders30d: 20, ordersPrev30d: 18 });
const unrated = buildDish("unrated-dish", 12000, {});

describe("buildDishRails", () => {
  it("should place each dish under the claim its evidence supports", () => {
    // Arrange
    const dishes = [loved, trending, gem, unrated];

    // Act
    const rails = buildDishRails(dishes);
    const byKey = Object.fromEntries(rails.map(rail => [rail.key, rail.dishes.map(dish => dish.id)]));

    // Assert
    expect(byKey.loved).toContain("loved-dish");
    expect(byKey.trending).toContain("trending-dish");
    expect(byKey.gem).toContain("gem-dish");
    expect(rails.flatMap(rail => rail.dishes.map(dish => dish.id))).not.toContain("unrated-dish");
  });

  it("should leave out a rail with nothing behind it", () => {
    // Arrange & Act
    const rails = buildDishRails([unrated]);

    // Assert
    expect(rails).toEqual([]);
  });

  it("should keep a sold-out dish out of every rail", () => {
    // Arrange
    const soldOut = { ...loved, isAvailable: false };

    // Act
    const rails = buildDishRails([soldOut]);

    // Assert
    expect(rails).toEqual([]);
  });

  it("should return only the sections asked for, in that order", () => {
    // Arrange & Act
    const rails = buildDishRails([loved, trending, gem], { sections: ["gem", "loved"] });

    // Assert
    expect(rails.map(rail => rail.key)).toEqual(["gem", "loved"]);
  });

  it("should honour a caller's limit over the rail's own cap", () => {
    // Arrange
    const alsoLoved = buildDish("also-loved", 50000, { avgRating: 4.6, ratingCount: 50, orders30d: 100, ordersPrev30d: 95 });

    // Act
    const [rail] = buildDishRails([loved, alsoLoved], { sections: ["loved"], limit: 1 });

    // Assert
    expect(rail.dishes).toHaveLength(1);
  });

  it("should order trending by how fast each dish is climbing", () => {
    // Arrange
    const climbing = buildDish("climbing", 25000, { orders30d: 90, ordersPrev30d: 20 });

    // Act
    const [rail] = buildDishRails([trending, climbing], { sections: ["trending"] });

    // Assert
    expect(rail.dishes.map(dish => dish.id)).toEqual(["climbing", "trending-dish"]);
  });
});
