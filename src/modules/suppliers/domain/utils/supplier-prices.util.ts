import { IDelivery, IIngredientPrice } from "../interfaces/suppliers.interface";

/**
 * Per ingredient, the latest unit price and how far it moved from the priced delivery before it.
 * `deliveries` may be in any order; unpriced ones are ignored.
 */
export function ingredientPrices(deliveries: IDelivery[]): IIngredientPrice[] {
  const byIngredient = new Map<string, IDelivery[]>();
  for (const d of deliveries) {
    if (!d.cost || d.quantity <= 0) continue;
    byIngredient.set(d.ingredientId, [...(byIngredient.get(d.ingredientId) ?? []), d]);
  }
  return [...byIngredient.values()]
    .map(rows => {
      const [latest, before] = rows.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
      const unit = (d: IDelivery) => (d.cost as number) / d.quantity;
      return {
        ingredientId: latest.ingredientId,
        ingredientName: latest.ingredientName,
        unit: latest.unit,
        latestUnitCost: unit(latest),
        previousUnitCost: before ? unit(before) : null,
        previousAt: before?.receivedAt ?? null,
        cheaper: null,
        changePercent: before ? Math.round(((unit(latest) - unit(before)) / unit(before)) * 100) : null,
      };
    })
    .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
}

/** One supplier's latest priced delivery of one ingredient, per base unit. */
export interface IOtherPrice {
  ingredientId: string;
  supplier: string;
  unitCost: number;
}

/** Marks each price with the cheapest other supplier for that ingredient, when one is cheaper. */
export function withCheaper(prices: IIngredientPrice[], others: IOtherPrice[]): IIngredientPrice[] {
  return prices.map(p => {
    const best = others
      .filter(o => o.ingredientId === p.ingredientId && o.unitCost < p.latestUnitCost)
      .sort((a, b) => a.unitCost - b.unitCost)[0];
    return best ? { ...p, cheaper: { supplier: best.supplier, unitCost: best.unitCost } } : p;
  });
}
