import { canMakeOne, usageForItem } from "../recipe.util";

const lines = [
  { ingredientId: "chicken", variantId: null, addOnId: null, quantity: 200 },
  { ingredientId: "cheese", variantId: null, addOnId: "extra-cheese", quantity: 30 },
  { ingredientId: "chicken", variantId: "large", addOnId: null, quantity: 100 },
];

describe("usageForItem", () => {
  it("uses only the base recipe when nothing extra is picked", () => {
    expect(usageForItem(lines, { variantId: null, addOnIds: [], quantity: 2 })).toEqual(new Map([["chicken", 400]]));
  });

  it("adds the picked variant and add-on lines, scaled by quantity", () => {
    const usage = usageForItem(lines, { variantId: "large", addOnIds: ["extra-cheese"], quantity: 2 });
    expect(usage).toEqual(
      new Map([
        ["chicken", 600],
        ["cheese", 60],
      ])
    );
  });
});

describe("canMakeOne", () => {
  it("is false as soon as one ingredient is short", () => {
    expect(
      canMakeOne([
        { quantity: 200, ingredient: { quantity: 500 } },
        { quantity: 50, ingredient: { quantity: 49 } },
      ])
    ).toBe(false);
  });

  it("is true when stock exactly covers the recipe", () => {
    expect(canMakeOne([{ quantity: 200, ingredient: { quantity: 200 } }])).toBe(true);
  });
});
