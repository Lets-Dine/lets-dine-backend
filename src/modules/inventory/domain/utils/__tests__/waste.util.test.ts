import { summarizeWaste, wasteCost } from "../waste.util";

describe("wasteCost", () => {
  const lots = [
    { id: "old", cost: 1000, quantity: 500 },
    { id: "new", cost: 3000, quantity: 1000 },
  ];

  it("prices each lot's share at that lot's own rate", () => {
    // 300 of the old lot (Rs 2/unit-ish: 1000/500) + 100 of the new (3000/1000)
    expect(
      wasteCost(
        lots,
        [
          { lotId: "old", quantity: 300 },
          { lotId: "new", quantity: 100 },
        ],
        400
      )
    ).toBe(600 + 300);
  });

  it("is unknown when part of the amount came from no lot", () => {
    expect(wasteCost(lots, [{ lotId: "old", quantity: 300 }], 400)).toBeNull();
  });

  it("is unknown when a lot has no price, never free", () => {
    expect(wasteCost([{ id: "x", cost: null, quantity: 100 }], [{ lotId: "x", quantity: 50 }], 50)).toBeNull();
  });
});

describe("summarizeWaste", () => {
  const row = (o: Partial<Parameters<typeof summarizeWaste>[0][number]>) => ({
    ingredientId: "i1",
    ingredientName: "Chicken",
    unit: "g",
    quantity: 100,
    reason: "SPOILED",
    cost: 500,
    ...o,
  });

  it("totals by reason and ingredient, most expensive first, and counts unpriced entries apart", () => {
    const s = summarizeWaste([
      row({}),
      row({ cost: null }),
      row({ ingredientId: "i2", ingredientName: "Milk", unit: "ml", reason: "EXPIRED", cost: 900, quantity: 1000 }),
    ]);
    expect(s).toMatchObject({ count: 3, cost: 1400, unpriced: 1 });
    expect(s.byReason.map(r => [r.reason, r.cost])).toEqual([
      ["EXPIRED", 900],
      ["SPOILED", 500],
    ]);
    expect(s.byIngredient[0]).toMatchObject({ name: "Milk", quantity: 1000, cost: 900 });
    expect(s.byIngredient[1]).toMatchObject({ name: "Chicken", quantity: 200, count: 2, unpriced: 1 });
  });

  it("is all zeros with no waste", () => {
    expect(summarizeWaste([])).toEqual({ count: 0, cost: 0, unpriced: 0, byReason: [], byIngredient: [] });
  });
});
