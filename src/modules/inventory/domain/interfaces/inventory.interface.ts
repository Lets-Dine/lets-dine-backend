export interface IIngredient {
  id: string;
  restaurantId: string;
  branchId: string;
  name: string;
  unit: string;
  quantity: number;
  parLevel: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecipeLine {
  id: string;
  dishId: string;
  ingredientId: string;
  variantId: string | null;
  addOnId: string | null;
  quantity: number;
}

/** How reviews of the dishes a lot went into compare with the rest of that ingredient. */
export interface ILotQuality {
  lotId: string;
  ingredientId: string;
  ingredientName: string;
  supplier: string | null;
  receivedAt: Date;
  reviewCount: number;
  poorCount: number;
  poorRate: number;
  baselineRate: number;
  flagged: boolean;
}

/** One time the kitchen used an ingredient: when, which dish, and how much came off the shelf. */
export interface IUsageEntry {
  id: string;
  at: Date;
  /** The dish it went into; null for use that was not for a dish (waste, a staff meal). */
  dishName: string | null;
  /** "order" when the kitchen started a dish, "manual" when someone recorded it. */
  source: "order" | "manual";
  /** Why, for manual use. */
  note: string;
  /** Portions on the order line it was taken for; null for manual use. */
  portions: number | null;
  /** Base units of the ingredient taken. */
  quantity: number;
}

/** How one ingredient has moved over the last `days`, and where it was last bought. */
export interface IIngredientSummary {
  days: number;
  /** Base units that came in (deliveries, transfers in, upward corrections). */
  stockIn: number;
  /** Base units that went out (dishes, transfers out, downward corrections). */
  stockOut: number;
  lastMovement: { reason: string; delta: number; note: string; at: Date } | null;
  lastPurchase: { supplier: string | null; cost: number | null; quantity: number; at: Date } | null;
}

/** One delivery of an ingredient: when it arrived, from whom, how much, and what was paid. */
export interface IPurchase {
  id: string;
  at: Date;
  supplier: string | null;
  quantity: number;
  cost: number | null;
}

export interface IUsagePage {
  items: IUsageEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IBuyListItem {
  ingredientId: string;
  name: string;
  unit: string;
  onHand: number;
  parLevel: number;
  /** Base units expected to be used over the horizon, from the same weekdays of the last three weeks, recent ones counting more. */
  expectedUse: number;
  toBuy: number;
  /** Where it was last bought; null if no delivery ever named a supplier. */
  supplier: string | null;
  /** Minor units, at the price of the last purchase; null when that price is unknown. */
  estimatedCost: number | null;
}

/** One portion of a dish (or one of its variants) costed from the latest delivery prices. */
export interface IDishMargin {
  dishId: string;
  name: string;
  variantName: string | null;
  price: number;
  cost: number;
  margin: number;
  missing: string[];
  drivers: { ingredientName: string; share: number; changeSincePrevious: number | null }[];
}

/** What a stock take found for one counted ingredient. */
export interface IStockTakeResult {
  ingredientId: string;
  name: string;
  unit: string;
  /** What the system thought was on the shelf. Only revealed after the count is in. */
  expected: number;
  counted: number;
  /** counted − expected: negative = missing. */
  difference: number;
  /** Minor units the difference is worth at the latest delivery price; null when that price is unknown. */
  value: number | null;
}
