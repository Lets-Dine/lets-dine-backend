export interface IOpenLot {
  id: string;
  remaining: number;
}

export interface ILotAllocation {
  lotId: string;
  quantity: number;
}

/**
 * First in, first out: takes `need` from `lots` (already oldest-first), emptying each before
 * touching the next. Whatever the lots can't cover is simply left out — stock may run negative,
 * and that part belongs to no lot.
 */
export function allocateFifo(lots: IOpenLot[], need: number): ILotAllocation[] {
  const out: ILotAllocation[] = [];
  let left = need;
  for (const lot of lots) {
    if (left <= 0) break;
    const take = Math.min(lot.remaining, left);
    if (take <= 0) continue;
    out.push({ lotId: lot.id, quantity: take });
    left -= take;
  }
  return out;
}
