import { LoyaltyEntryType } from "@prisma/client";
import { PrismaTransaction } from "../../../../common/prisma";
import { ILoyaltyCustomer, ILoyaltyEntry, ILoyaltyOrder, ILoyaltyProgram } from "../interfaces/loyalty.interface";

export interface ILoyaltyEntryCreate {
  restaurantId: string;
  customerId: string;
  type: LoyaltyEntryType;
  points: number;
  paymentId?: string | null;
  orderId?: string | null;
  note?: string;
  createdBy?: string | null;
  createdByName?: string | null;
}

export interface ILoyaltyOptions {
  tx?: PrismaTransaction;
}

export abstract class LoyaltyRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findProgram(restaurantId: string, options?: ILoyaltyOptions): Promise<ILoyaltyProgram | null>;
  abstract upsertProgram(
    restaurantId: string,
    data: ILoyaltyProgram,
    updatedBy: string,
    options?: ILoyaltyOptions
  ): Promise<ILoyaltyProgram>;
  /** Records one line. A line tied to a payment is written once per (payment, type): a retry is a no-op. */
  abstract createEntry(data: ILoyaltyEntryCreate, options?: ILoyaltyOptions): Promise<ILoyaltyEntry>;
  /** Holds a lock on this customer's ledger until the transaction ends, so two balance checks cannot interleave. */
  abstract lockLedger(restaurantId: string, customerId: string, options: { tx: PrismaTransaction }): Promise<void>;
  abstract getBalance(restaurantId: string, customerId: string, options?: ILoyaltyOptions): Promise<number>;
  abstract fetchEntries(
    restaurantId: string,
    customerId: string,
    page: { limit: number; offset: number },
    options?: ILoyaltyOptions
  ): Promise<{ rows: ILoyaltyEntry[]; count: number }>;
  /** The facts about one order loyalty needs, whoever's it is: callers check it belongs to their session. */
  abstract findOrder(orderId: string, options?: ILoyaltyOptions): Promise<ILoyaltyOrder | null>;
  /** What a visit's live (not cancelled) orders add up to before fees, less their discounts: the base a table's bill will earn on. */
  abstract sumVisitEarnableBase(sessionId: string, options?: ILoyaltyOptions): Promise<number>;
  /** Whether any payment has been taken for a visit. */
  abstract hasSessionPayment(sessionId: string, options?: ILoyaltyOptions): Promise<boolean>;
  /** Whether this order already has a line of this type (used for the once-per-order review bonus). */
  abstract hasOrderEntry(orderId: string, type: LoyaltyEntryType, options?: ILoyaltyOptions): Promise<boolean>;
  /** Points earned on one order's own bill. */
  abstract sumEarnedForOrder(orderId: string, options?: ILoyaltyOptions): Promise<number>;
  /** Points a customer earned on the bills of one visit (a table's bill spans orders, so it is found by session). */
  abstract sumEarnedForSession(sessionId: string, customerId: string, options?: ILoyaltyOptions): Promise<number>;
  /** The customer, only if they are one of this restaurant's regulars. */
  abstract findCustomer(restaurantId: string, customerId: string, options?: ILoyaltyOptions): Promise<ILoyaltyCustomer | null>;
}
