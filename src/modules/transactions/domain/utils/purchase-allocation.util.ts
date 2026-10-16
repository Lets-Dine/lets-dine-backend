/** One credit delivery as the supplier ledger sees it. */
export interface ICreditLot {
  id: string;
  supplier: string;
  cost: number;
  receivedAt: Date;
}

/**
 * How much of each credit delivery is already settled. A supplier's payments (and what returns took off
 * the debt) are a running balance, not tied to a bill, so they are spread oldest delivery first — the
 * way a supplier statement reads. This only presents the existing balance per bill; it never changes
 * what is owed, so the per-supplier total always equals `owedOf`.
 */
export function allocatePaid(lots: ICreditLot[], settledBySupplier: Map<string, number>): Map<string, number> {
  const pool = new Map(settledBySupplier);
  const paid = new Map<string, number>();
  const oldestFirst = [...lots].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id));
  for (const lot of oldestFirst) {
    const key = lot.supplier.toLowerCase();
    const take = Math.min(lot.cost, pool.get(key) ?? 0);
    pool.set(key, (pool.get(key) ?? 0) - take);
    paid.set(lot.id, take);
  }
  return paid;
}
