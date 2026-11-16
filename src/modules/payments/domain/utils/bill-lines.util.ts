/** One line of a bill, as either side states it: what was ordered, or what the cashier is charging for. */
export interface IBillLine {
  dishId: string;
  variantId?: string | null;
  addOnIds?: string[];
  quantity: number;
}

/** Two lines are the same line when the dish, the size and the extras are: a large and a small of one dish are different lines. */
export function billLineKey(line: Pick<IBillLine, "dishId" | "variantId" | "addOnIds">): string {
  return [line.dishId, line.variantId ?? "", [...(line.addOnIds ?? [])].sort().join(",")].join("|");
}

/** Lines folded into key -> quantity, so two order lines of the same dish and options count as one. */
export function tallyBillLines(lines: IBillLine[]): Map<string, number> {
  const tally = new Map<string, number>();
  for (const line of lines) tally.set(billLineKey(line), (tally.get(billLineKey(line)) ?? 0) + line.quantity);
  return tally;
}

/**
 * Whether the bill being charged is not exactly what was ordered: a line dropped, a quantity changed, a dish swapped
 * for another, or something added. Compared line by line, never by count or total, because either of those lets a dear
 * dish be swapped for a cheap one unnoticed.
 */
export function billDiffersFromOrder(charged: IBillLine[], ordered: IBillLine[]): boolean {
  const want = tallyBillLines(ordered);
  const got = tallyBillLines(charged);
  if (want.size !== got.size) return true;
  for (const [key, quantity] of want) if (got.get(key) !== quantity) return true;
  return false;
}
