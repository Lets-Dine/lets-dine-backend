/** Latest and previous price per base unit (minor units, fractional) of one ingredient. */
export interface IUnitCost {
  unit: number;
  previous: number | null;
}

export interface IRecipeCostLine {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
}

export interface ICostDriver {
  ingredientName: string;
  /** Share of the dish's cost, 0–1. */
  share: number;
  /** Price change versus the delivery before, 0.12 = up 12%; null when there is no earlier price. */
  changeSincePrevious: number | null;
}

export interface IMargin {
  /** Minor units to make one portion, from the latest delivery prices. */
  cost: number;
  /** (price − cost) / price. Only a floor on cost when `missing` is not empty — see below. */
  margin: number;
  /** Ingredients with no known price. While any are missing, `cost` is too low and `margin` too high. */
  missing: string[];
  /** The costliest ingredients, biggest first. */
  drivers: ICostDriver[];
}

/** Price per base unit from one lot: what it cost divided by how much it held. */
export function unitCostOfLot(cost: number, quantity: number): number {
  return cost / quantity;
}

/** Cost and margin of one portion: each recipe line at the ingredient's latest delivery price. */
export function computeMargin(price: number, lines: IRecipeCostLine[], costs: Map<string, IUnitCost>): IMargin {
  const missing: string[] = [];
  const priced: { line: IRecipeCostLine; amount: number; unit: IUnitCost }[] = [];
  for (const line of lines) {
    const unit = costs.get(line.ingredientId);
    if (!unit) missing.push(line.ingredientName);
    else priced.push({ line, amount: line.quantity * unit.unit, unit });
  }
  const total = priced.reduce((sum, p) => sum + p.amount, 0);
  return {
    cost: Math.round(total),
    margin: price > 0 ? (price - total) / price : 0,
    missing,
    drivers: priced
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map(p => ({
        ingredientName: p.line.ingredientName,
        share: total > 0 ? p.amount / total : 0,
        changeSincePrevious: p.unit.previous ? p.unit.unit / p.unit.previous - 1 : null,
      })),
  };
}
