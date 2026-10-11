import {
  DeliveryAccountKind,
  DeliveryAssignmentStatus,
  DeliveryFeeModel,
  DeliveryRiderKind,
  DeliveryRiderPayModel,
  DeliverySettlementDirection,
  DeliverySettlementMethod,
} from "@prisma/client";

/** The wire shapes below are exactly what the dashboard's `domain/delivery.ts` types read — keep them in step. */

export interface IDeliveryPartner {
  id: string;
  restaurantId: string;
  branchId: string;
  name: string;
  phone: string;
  contactPerson: string;
  note: string;
  feeModel: DeliveryFeeModel;
  /** Minor units for FLAT; basis points for PERCENT (1200 = 12%). */
  feeValue: number;
  collectsCash: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface IDeliveryRider {
  id: string;
  restaurantId: string;
  branchId: string;
  partnerId: string | null;
  name: string;
  phone: string;
  kind: DeliveryRiderKind;
  vehicle: string;
  note: string;
  payModel: DeliveryRiderPayModel;
  /** Minor units per delivery when `payModel` is PER_DELIVERY. */
  payValue: number;
  isActive: boolean;
  createdAt: Date;
}

export interface IDeliveryAssignment {
  id: string;
  restaurantId: string;
  branchId: string;
  orderId: string;
  orderRef: string;
  customerName: string;
  orderTotal: number;
  riderId: string | null;
  partnerId: string | null;
  riderName: string | null;
  partnerName: string | null;
  accountKind: DeliveryAccountKind;
  accountId: string;
  status: DeliveryAssignmentStatus;
  assignedAt: Date;
  deliveredAt: Date | null;
  courierFee: number;
  cashToCollect: number;
  cashCollected: number | null;
}

export interface IDeliverySettlement {
  id: string;
  restaurantId: string;
  branchId: string;
  accountKind: DeliveryAccountKind;
  accountId: string;
  /** Set when it was settled as part of settling one order. */
  orderId: string | null;
  direction: DeliverySettlementDirection;
  amount: number;
  offset: number;
  method: DeliverySettlementMethod;
  note: string;
  /** Named `at` on the wire, as the dashboard reads it. */
  at: Date;
}

/** Everything one branch has: couriers, runs and settlements. The dashboard derives balances from these. */
export interface IDeliveryBook {
  partners: IDeliveryPartner[];
  riders: IDeliveryRider[];
  assignments: IDeliveryAssignment[];
  settlements: IDeliverySettlement[];
}

/** What a courier account holds and is owed, derived in SQL from its runs and settlements. */
export interface IDeliveryBalance {
  /** Cash collected at the door and not yet handed over. */
  cashHeld: number;
  /** Fees earned and not yet paid out. */
  feesOwed: number;
  /** `cashHeld − feesOwed`. Positive: they owe the branch. Negative: the branch owes them. */
  net: number;
  /** Runs still on the road. */
  open: number;
}

/** A partner as the listing shows it: terms, balance and two counts. No runs, no settlements. */
export interface IPartnerListing extends IDeliveryPartner {
  balance: IDeliveryBalance;
  riders: number;
  /** Deliveries completed in the last 30 days. */
  runs30: number;
}

/** A rider as the listing shows it. `balance` is null when they ride for a partner — the partner's account takes it. */
export interface IRiderListing extends IDeliveryRider {
  balance: IDeliveryBalance | null;
  open: number;
  partnerName: string | null;
  runs30: number;
}

/** The Delivery page: every courier with its balance, and the three numbers of the headline sentence. */
export interface IDeliveryOverview {
  partners: IPartnerListing[];
  riders: IRiderListing[];
  summary: { onRoad: number; cashOut: number; owed: number };
}

/** One courier's page, minus its statement (see `IStatementPage`). */
export interface IDeliveryCourierDetail {
  partner: IPartnerListing | null;
  rider: IRiderListing | null;
  /** The partner a rider rides for. */
  parent: IDeliveryPartner | null;
  /** Runs still on the road: this rider's, or any under this partner. */
  openRuns: IDeliveryAssignment[];
  /** A partner's riders. */
  riders: IRiderListing[];
  /** Active partners, plus the rider's own: what the rider's terms can be moved to. Empty for a partner. */
  partners: IDeliveryPartner[];
}

/**
 * One line of a courier's statement. `delta` moves the net balance and `balanceAfter` is the running
 * balance. A partner's rider has no account, so theirs are plain `RUN` lines with neither.
 */
export type IStatementEntry =
  | { type: "DELIVERY"; id: string; at: Date; delta: number; balanceAfter: number; assignment: IDeliveryAssignment }
  | { type: "SETTLEMENT"; id: string; at: Date; delta: number; balanceAfter: number; settlement: IDeliverySettlement }
  | { type: "RUN"; id: string; at: Date; assignment: IDeliveryAssignment };

/** Newest first. `nextCursor` is passed back as `cursor` for the next page, null at the end. */
export interface IStatementPage {
  entries: IStatementEntry[];
  nextCursor: string | null;
}

/** The order fields a dispatch needs, read once. */
export interface IDeliveryOrder {
  id: string;
  reference: string;
  restaurantId: string;
  branchId: string;
  orderType: string;
  status: string;
  total: number;
  deliveryCustomerName: string | null;
}
