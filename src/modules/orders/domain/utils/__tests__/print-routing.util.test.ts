import { KitchenStation } from "@prisma/client";
import { RoutablePrinter, routePrintJobs } from "../print-routing.util";

const printer = (over: Partial<RoutablePrinter> = {}): RoutablePrinter => ({
  id: "p1",
  fullKot: false,
  stations: [],
  tableAssignment: false,
  tableIds: [],
  floorIds: [],
  ...over,
});
const kot = { id: "k", station: KitchenStation.KITCHEN };
const bot = { id: "b", station: KitchenStation.BAR };
const dineIn = { tableId: "t1", floorId: null };

describe("routePrintJobs", () => {
  it("sends each ticket to the printer of its station, one slip each", () => {
    const jobs = routePrintJobs([kot, bot], dineIn, [
      printer({ id: "kitchen", stations: [KitchenStation.KITCHEN] }),
      printer({ id: "bar", stations: [KitchenStation.BAR] }),
    ]);
    expect(jobs).toEqual([
      { printerId: "kitchen", ticketIds: ["k"] },
      { printerId: "bar", ticketIds: ["b"] },
    ]);
  });

  it("puts every ticket on one slip for a full-KOT printer, ignoring its stations", () => {
    const jobs = routePrintJobs([kot, bot], dineIn, [printer({ fullKot: true, stations: [KitchenStation.BAR] })]);
    expect(jobs).toEqual([{ printerId: "p1", ticketIds: ["k", "b"] }]);
  });

  it("prints nothing on a printer with no station and no full KOT", () => {
    expect(routePrintJobs([kot, bot], dineIn, [printer()])).toEqual([]);
  });

  it("serves only its assigned tables when table assignment is on", () => {
    const p = printer({ fullKot: true, tableAssignment: true, tableIds: ["t1"] });
    expect(routePrintJobs([kot], dineIn, [p])).toHaveLength(1);
    expect(routePrintJobs([kot], { tableId: "t2", floorId: null }, [p])).toEqual([]);
  });

  it("also matches by floor", () => {
    const p = printer({ fullKot: true, tableAssignment: true, floorIds: ["f1"] });
    expect(routePrintJobs([kot], { tableId: null, floorId: "f1" }, [p])).toHaveLength(1);
  });

  it("never matches a delivery order to a table-assigned printer, nor a printer with nothing ticked", () => {
    const delivery = { tableId: null, floorId: null };
    expect(routePrintJobs([kot], delivery, [printer({ fullKot: true, tableAssignment: true, tableIds: ["t1"] })])).toEqual([]);
    expect(routePrintJobs([kot], dineIn, [printer({ fullKot: true, tableAssignment: true })])).toEqual([]);
    expect(routePrintJobs([kot], delivery, [printer({ fullKot: true })])).toHaveLength(1);
  });
});
