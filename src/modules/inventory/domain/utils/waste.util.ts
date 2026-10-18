import { ILotAllocation } from "./lot.util";

export interface IPricedLot {
  id: string;
  cost: number | null;
  quantity: number;
}

/**
 * What the lots a waste entry drew from cost, in minor units. Null unless every unit is covered by a
 * priced lot: stock with no lot behind it (a negative count) or an unpriced delivery is unknown, never free.
 */
export function wasteCost(lots: IPricedLot[], allocations: ILotAllocation[], need: number): number | null {
  const byId = new Map(lots.map(l => [l.id, l]));
  let covered = 0;
  let cost = 0;
  for (const { lotId, quantity } of allocations) {
    const lot = byId.get(lotId);
    if (!lot || lot.cost === null || lot.quantity <= 0) return null;
    cost += (quantity * lot.cost) / lot.quantity;
    covered += quantity;
  }
  return covered === need ? Math.round(cost) : null;
}

export interface IWasteRow {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  /** Positive amount thrown away, in the ingredient's base unit. */
  quantity: number;
  reason: string;
  cost: number | null;
}

export interface IWasteTotals {
  count: number;
  /** Cost of the priced entries only. */
  cost: number;
  /** Entries that could not be priced, so `cost` is a floor when this is above zero. */
  unpriced: number;
}

export interface IWasteSummary extends IWasteTotals {
  byReason: ({ reason: string } & IWasteTotals)[];
  byIngredient: ({ ingredientId: string; name: string; unit: string; quantity: number } & IWasteTotals)[];
}

const empty = (): IWasteTotals => ({ count: 0, cost: 0, unpriced: 0 });
const add = (t: IWasteTotals, r: IWasteRow) => {
  t.count += 1;
  if (r.cost === null) t.unpriced += 1;
  else t.cost += r.cost;
};

/** Totals overall, by reason and by ingredient, each most expensive first. */
export function summarizeWaste(rows: IWasteRow[]): IWasteSummary {
  const total = empty();
  const byReason = new Map<string, IWasteTotals>();
  const byIngredient = new Map<string, IWasteTotals & { name: string; unit: string; quantity: number }>();
  for (const r of rows) {
    add(total, r);
    add(byReason.get(r.reason) ?? byReason.set(r.reason, empty()).get(r.reason)!, r);
    const ing =
      byIngredient.get(r.ingredientId) ??
      byIngredient.set(r.ingredientId, { ...empty(), name: r.ingredientName, unit: r.unit, quantity: 0 }).get(r.ingredientId)!;
    add(ing, r);
    ing.quantity += r.quantity;
  }
  const byCost = <T extends IWasteTotals>(a: T, b: T) => b.cost - a.cost || b.count - a.count;
  return {
    ...total,
    byReason: [...byReason].map(([reason, t]) => ({ reason, ...t })).sort(byCost),
    byIngredient: [...byIngredient].map(([ingredientId, t]) => ({ ingredientId, ...t })).sort(byCost),
  };
}
