import { shapeMargin } from "../margin.util";

const base = { dishId: "d", name: "Momo", price: 300, units: 10, revenue: 3000, costedUnits: 10, costedRevenue: 3000, cost: 1200, recipeCost: 118.6, ratingCount: 0, avgRating: null, againCount: null };

describe("shapeMargin", () => {
  it("works out margin over the costed units", () => {
    expect(shapeMargin(base)).toMatchObject({ cost: 1200, margin: 1800, marginPct: 0.6, coverage: 1, recipeCost: 119 });
  });

  it("reads a dish nothing could cost as unknown, not as free", () => {
    const r = shapeMargin({ ...base, costedUnits: 0, costedRevenue: 0, cost: null, recipeCost: null });
    expect(r).toMatchObject({ cost: null, margin: null, marginPct: null, coverage: 0, recipeCost: null });
  });

  it("measures a part-costed dish on the costed part only, and reports how much that was", () => {
    // 4 of 10 units costed: 1,200 revenue against 500 cost; the other 1,800 is not pretended to be profit.
    const r = shapeMargin({ ...base, costedUnits: 4, costedRevenue: 1200, cost: 500 });
    expect(r).toMatchObject({ margin: 700, coverage: 0.4 });
    expect(r.marginPct).toBeCloseTo(0.5833, 3);
  });
});

describe("ratings", () => {
  it("reports the raw average and withholds the recommend rate until there are enough reviews", () => {
    const r = shapeMargin({ ...base, ratingCount: 2, avgRating: 5, againCount: 2 });
    expect(r).toMatchObject({ avgRating: 5, ratingCount: 2, recommendRate: null });
  });

  it("leaves unrated dishes unrated and reports recommend rate from the minimum review count", () => {
    expect(shapeMargin(base)).toMatchObject({ avgRating: null, recommendRate: null });
    expect(shapeMargin({ ...base, ratingCount: 10, avgRating: 4, againCount: 9 }).recommendRate).toBe(0.9);
  });
});
