import { computeMargin, unitCostOfLot } from "../margin.util";

const costs = new Map([
  ["chicken", { unit: 0.4, previous: 0.32 }], // paisa per gram: up 25%
  ["rice", { unit: 0.1, previous: null }],
]);

describe("unitCostOfLot", () => {
  it("divides what was paid by what arrived", () => {
    // Rs 1,500 (150,000 paisa) for 10 kg.
    expect(unitCostOfLot(150000, 10000)).toBe(15);
  });
});

describe("computeMargin", () => {
  const lines = [
    { ingredientId: "chicken", ingredientName: "Chicken", quantity: 200 },
    { ingredientId: "rice", ingredientName: "Rice", quantity: 150 },
  ];

  it("costs a portion from the latest prices and reads off the margin", () => {
    const m = computeMargin(250, lines, costs); // 200*0.4 + 150*0.1 = 95
    expect(m.cost).toBe(95);
    expect(m.margin).toBeCloseTo(0.62);
    expect(m.missing).toEqual([]);
  });

  it("names the biggest cost first, with its price movement", () => {
    const [top, second] = computeMargin(250, lines, costs).drivers;
    expect(top).toMatchObject({ ingredientName: "Chicken", changeSincePrevious: expect.closeTo(0.25) });
    expect(top.share).toBeCloseTo(80 / 95);
    expect(second.changeSincePrevious).toBeNull();
  });

  it("reports unpriced ingredients instead of pretending the cost is complete", () => {
    const m = computeMargin(250, [...lines, { ingredientId: "oil", ingredientName: "Oil", quantity: 10 }], costs);
    expect(m.missing).toEqual(["Oil"]);
    expect(m.cost).toBe(95);
  });
});
