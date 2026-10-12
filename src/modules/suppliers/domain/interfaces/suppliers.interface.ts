import { PaymentMethod, SupplierIssueKind } from "@prisma/client";

export interface ISupplierRecord {
  id: string;
  name: string;
  phone: string;
  note: string;
  isArchived: boolean;
}

/** What a branch's deliveries add up to for one supplier (names that differ only in case are one supplier). */
export interface IDeliveryStats {
  deliveries: number;
  /** Minor units, only the deliveries that had a price, less what returns gave back. */
  spent: number;
  /** Minor units of `spent` that were bought on credit, less credit given back by returns. */
  credit: number;
  lastDeliveryAt: Date | null;
}

/** Stats under the name most often used for the supplier. */
export interface INamedStats extends IDeliveryStats {
  name: string;
}

/** A supplier as listed: saved ones, plus names that only appear on old deliveries (`id` null). */
export interface ISupplierListItem extends IDeliveryStats {
  id: string | null;
  name: string;
  phone: string;
  note: string;
  /** Minor units still owed for credit deliveries. */
  owed: number;
}

export interface IDelivery {
  id: string;
  receivedAt: Date;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  /** Minor units for the whole delivery; null when no price was entered. */
  cost: number | null;
  onCredit: boolean;
  /** What is left of this delivery on the shelf side of the books (the most that can go back). */
  remaining: number;
  /** Minor units already given back for returns from this delivery. */
  refunded: number;
}

/** How one ingredient's price from this supplier has moved between its last two priced deliveries. */
export interface IIngredientPrice {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  /** Minor units per base unit (gram, ml, piece) of the latest priced delivery. */
  latestUnitCost: number;
  /** Minor units per base unit of the priced delivery before the latest; null when there is only one. */
  previousUnitCost: number | null;
  /** When that previous priced delivery arrived. */
  previousAt: Date | null;
  /** The cheapest latest price for this ingredient from any other supplier, if it beats this one. */
  cheaper: { supplier: string; unitCost: number } | null;
  /** Whole-number percent against the delivery before; null when there is only one priced delivery. */
  changePercent: number | null;
}

export interface IPayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  note: string;
  createdAt: Date;
}

/** Stock sent back to the supplier, and what they gave back for it. */
export interface IReturn {
  id: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  /** Minor units given back, and how much of that came off what is owed (the rest was money back). */
  amount: number;
  owedOffset: number;
  note: string;
  createdAt: Date;
}

export interface IIssue {
  id: string;
  kind: SupplierIssueKind;
  note: string;
  createdAt: Date;
  createdByName: string | null;
}

export interface ISupplierDetail extends ISupplierListItem {
  /** The latest few; the rest are paged through `/deliveries`. */
  deliveriesList: IDelivery[];
  deliveriesTotal: number;
  prices: IIngredientPrice[];
  pricesTotal: number;
  payments: IPayment[];
  returns: IReturn[];
  issues: IIssue[];
  /** How many of each kind have ever been logged. */
  issueCounts: Record<SupplierIssueKind, number>;
}

export interface IPage<T> {
  rows: T[];
  count: number;
}
