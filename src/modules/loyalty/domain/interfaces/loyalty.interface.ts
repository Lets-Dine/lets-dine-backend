import { LoyaltyEntryType } from "@prisma/client";

export interface ILoyaltyProgram {
  enabled: boolean;
  /** Minor units of subtotal (less the cashier's own discount, not points spent) per point. */
  spendPerPoint: number;
  /** Minor units one redeemed point takes off a bill. */
  redeemValue: number;
  /** The most of a bill's discounted subtotal points may pay for, in percent. */
  maxRedeemPct: number;
  /** Points granted once per order when its diner rates a dish; 0 means no bonus. */
  reviewBonus: number;
}

export interface ILoyaltyEntry {
  id: string;
  type: LoyaltyEntryType;
  /** Signed: a spend is negative. */
  points: number;
  paymentId: string | null;
  note: string;
  createdAt: Date;
  createdByName: string | null;
}

export interface ILoyaltyCustomer {
  id: string;
  name: string;
  phone: string;
}

export interface ICustomerLoyalty {
  customer: ILoyaltyCustomer;
  balance: number;
  /** The rules the balance is spent under, so whoever takes the payment needs no settings access. */
  program: ILoyaltyProgram;
  entries: { rows: ILoyaltyEntry[]; count: number };
}

/** What a bill needs to say for points to be earned on it. */
export interface IEarnablePayment {
  id: string;
  restaurantId: string;
  customerId?: string | null;
  subtotal: number;
  discount: number;
  /** The part of `discount` that redeemed points paid for. Points spent on a bill do not shrink what it earns. */
  loyaltyDiscount?: number;
  /** Set when the bill is one order's own (a floor or delivery order), so the diner can be told what it earned. */
  orderId?: string | null;
}

/** What a diner may be told about points on one of their orders. Never a balance, a name or a number. */
export interface IOrderLoyalty {
  /** Points this order's bill earned. */
  earned: number;
  /** Points on offer for rating a dish, 0 when there is none or it was already given. */
  reviewBonus: number;
  reviewBonusGiven: boolean;
  /** Points this bill is expected to earn once it is paid; 0 when it already has, or would earn none. An estimate: a later add or cancel moves it. */
  expected: number;
}

/** The few order facts loyalty needs. */
export interface ILoyaltyOrder {
  id: string;
  restaurantId: string;
  sessionId: string;
  customerId: string | null;
  floorId: string | null;
  orderType: string;
  /** What the order is worth before service charge and tax, and the discount on it. */
  subtotal: number;
  discount: number;
  /** Set when this order's own bill was paid (floor orders). */
  paidAt: Date | null;
}
