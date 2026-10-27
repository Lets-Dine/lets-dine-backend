import { KitchenStation, OrderItemStatus } from "@prisma/client";
import { CurrentItem, SentLine, diffTicketLines } from "../ticket-delta.util";

const snap = { dishNameSnapshot: "Momo", variantNameSnapshot: null, addOnNames: [], notes: "" };
const item = (over: Partial<CurrentItem> = {}): CurrentItem => ({
  id: "i1",
  quantity: 2,
  status: OrderItemStatus.PENDING,
  station: KitchenStation.KITCHEN,
  ...snap,
  ...over,
});
const sent = (qtyDelta: number, over: Partial<SentLine> = {}): SentLine => ({
  orderItemId: "i1",
  qtyDelta,
  station: KitchenStation.KITCHEN,
  ...snap,
  ...over,
});

describe("diffTicketLines", () => {
  it("sends the full quantity of a line the pass has never seen", () => {
    expect(diffTicketLines([item()], []).map(l => l.qtyDelta)).toEqual([2]);
  });

  it("sends nothing when the pass is already up to date (safe to call twice)", () => {
    expect(diffTicketLines([item()], [sent(2)])).toEqual([]);
  });

  it("sends only the extra plate when quantity grew", () => {
    expect(diffTicketLines([item({ quantity: 3 })], [sent(2)]).map(l => l.qtyDelta)).toEqual([1]);
  });

  it("voids one when quantity shrank", () => {
    expect(diffTicketLines([item({ quantity: 1 })], [sent(2)]).map(l => l.qtyDelta)).toEqual([-1]);
  });

  it("voids the whole line when it is cancelled", () => {
    expect(diffTicketLines([item({ status: OrderItemStatus.CANCELLED })], [sent(2)]).map(l => l.qtyDelta)).toEqual([-2]);
  });

  it("never voids food that is already cooked", () => {
    expect(diffTicketLines([item({ status: OrderItemStatus.READY, quantity: 1 })], [sent(2)])).toEqual([]);
  });

  it("voids a deleted line from its earlier snapshot and station", () => {
    const drafts = diffTicketLines([], [sent(2, { station: KitchenStation.BAR, dishNameSnapshot: "Mojito" })]);
    expect(drafts).toEqual([expect.objectContaining({ qtyDelta: -2, station: KitchenStation.BAR, dishNameSnapshot: "Mojito" })]);
  });

  it("nets earlier voids before deciding (+2, -1 sent means 1 outstanding)", () => {
    expect(diffTicketLines([item({ quantity: 1 })], [sent(2), sent(-1)])).toEqual([]);
  });

  it("keeps a re-added line on its original station if the dish later moved", () => {
    const drafts = diffTicketLines([item({ quantity: 3, station: KitchenStation.BAR })], [sent(2)]);
    expect(drafts[0].station).toBe(KitchenStation.KITCHEN);
  });
});
