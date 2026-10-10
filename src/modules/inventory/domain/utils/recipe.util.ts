export interface IRecipeLineRule {
  ingredientId: string;
  /** Null on both = the dish's base recipe; one set = extra, only when that variant/add-on is picked. */
  variantId: string | null;
  addOnId: string | null;
  quantity: number;
}

export interface IOrderedItem {
  variantId: string | null;
  addOnIds: string[];
  quantity: number;
}

/** Base units of each ingredient one ordered line uses: base recipe + picked variant + picked add-ons, × quantity. */
export function usageForItem(lines: IRecipeLineRule[], item: IOrderedItem): Map<string, number> {
  const usage = new Map<string, number>();
  for (const line of lines) {
    const applies = line.variantId ? line.variantId === item.variantId : line.addOnId ? item.addOnIds.includes(line.addOnId) : true;
    if (!applies) continue;
    usage.set(line.ingredientId, (usage.get(line.ingredientId) ?? 0) + line.quantity * item.quantity);
  }
  return usage;
}

/** Whether one more portion of a dish can be made: every base ingredient has at least its recipe quantity. */
export function canMakeOne(baseLines: { quantity: number; ingredient: { quantity: number } }[]): boolean {
  return baseLines.every(line => line.ingredient.quantity >= line.quantity);
}
