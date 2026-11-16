import { billDiffersFromOrder, billLineKey } from "../bill-lines.util";

const momo = { dishId: "momo", variantId: null, addOnIds: [], quantity: 2 };

describe("billDiffersFromOrder", () => {
  it("should accept exactly what was ordered, however the lines are split or ordered", () => {
    expect(billDiffersFromOrder([momo], [momo])).toBe(false);
    // The same dish ordered in two rounds is one line on the bill.
    expect(billDiffersFromOrder([{ ...momo, quantity: 3 }], [{ ...momo, quantity: 1 }, { ...momo, quantity: 2 }])).toBe(false);
    expect(billDiffersFromOrder([{ ...momo, addOnIds: ["b", "a"] }, { dishId: "tea", quantity: 1 }], [{ dishId: "tea", quantity: 1 }, { ...momo, addOnIds: ["a", "b"] }])).toBe(false);
  });

  it("should flag a dropped line, a smaller quantity, an extra line and a swapped dish", () => {
    expect(billDiffersFromOrder([], [momo])).toBe(true);
    expect(billDiffersFromOrder([{ ...momo, quantity: 1 }], [momo])).toBe(true);
    expect(billDiffersFromOrder([momo, { dishId: "tea", quantity: 1 }], [momo])).toBe(true);
    // Same count and quantity, but a cheap dish stands in for a dear one: totals and counts alone would miss this.
    expect(billDiffersFromOrder([{ dishId: "tea", quantity: 2 }], [momo])).toBe(true);
  });

  it("should tell a size, or an extra, apart from the plain dish", () => {
    expect(billDiffersFromOrder([{ ...momo, variantId: "small" }], [{ ...momo, variantId: "large" }])).toBe(true);
    expect(billDiffersFromOrder([momo], [{ ...momo, addOnIds: ["cheese"] }])).toBe(true);
    expect(billLineKey({ dishId: "x", addOnIds: ["a", "a"] })).not.toBe(billLineKey({ dishId: "x", addOnIds: ["a"] }));
  });
});
