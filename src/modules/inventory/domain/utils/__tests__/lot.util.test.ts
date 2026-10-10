import { allocateFifo } from "../lot.util";

describe("allocateFifo", () => {
  const lots = [
    { id: "old", remaining: 300 },
    { id: "new", remaining: 500 },
  ];

  it("uses the oldest lot first and spills into the next", () => {
    expect(allocateFifo(lots, 400)).toEqual([
      { lotId: "old", quantity: 300 },
      { lotId: "new", quantity: 100 },
    ]);
  });

  it("stays inside one lot when it covers the need", () => {
    expect(allocateFifo(lots, 200)).toEqual([{ lotId: "old", quantity: 200 }]);
  });

  it("leaves the uncovered part unallocated when stock runs out", () => {
    expect(allocateFifo(lots, 1000)).toEqual([
      { lotId: "old", quantity: 300 },
      { lotId: "new", quantity: 500 },
    ]);
  });

  it("skips empty lots", () => {
    expect(allocateFifo([{ id: "empty", remaining: 0 }, ...lots], 100)).toEqual([{ lotId: "old", quantity: 100 }]);
  });
});
