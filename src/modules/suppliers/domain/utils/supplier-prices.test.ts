import { ingredientPrices, withCheaper } from "./supplier-prices.util";

const d = (id: string, day: number, quantity: number, cost: number | null) => ({
  id: `${id}${day}`,
  receivedAt: new Date(2026, 9, day),
  ingredientId: id,
  ingredientName: id,
  unit: "g",
  quantity,
  cost,
  onCredit: false,
  remaining: quantity,
  refunded: 0,
});

describe("ingredientPrices", () => {
  it("compares the last two priced deliveries by unit price, ignoring unpriced ones", () => {
    const [chicken] = ingredientPrices([d("chicken", 1, 1000, 400), d("chicken", 5, 1000, null), d("chicken", 9, 2000, 1000)]);
    expect(chicken.latestUnitCost).toBeCloseTo(0.5);
    expect(chicken.changePercent).toBe(25);
    expect(chicken.previousUnitCost).toBeCloseTo(0.4);
  });

  it("has no change with a single priced delivery", () => {
    expect(ingredientPrices([d("rice", 1, 1000, 100)])[0].changePercent).toBeNull();
  });
});

describe("withCheaper", () => {
  it("names the cheapest other supplier, only when it beats this one", () => {
    const [rice] = ingredientPrices([d("rice", 1, 1000, 500)]);
    const [cheaper] = withCheaper([rice], [
      { ingredientId: "rice", supplier: "Hari", unitCost: 0.4 },
      { ingredientId: "rice", supplier: "Sita", unitCost: 0.45 },
      { ingredientId: "rice", supplier: "Dear", unitCost: 0.6 },
    ]);
    expect(cheaper.cheaper).toEqual({ supplier: "Hari", unitCost: 0.4 });
    expect(withCheaper([rice], [{ ingredientId: "rice", supplier: "Dear", unitCost: 0.6 }])[0].cheaper).toBeNull();
  });
});
