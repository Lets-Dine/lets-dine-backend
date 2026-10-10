import { BillingInterval, SubscriptionStatus } from "@prisma/client";
import { PrismaTransaction } from "../../../../common/prisma";
import { IBillingSubscription, ILifecycleSubscription, ISubscriptionDetail } from "../interfaces/billing.interface";

export interface ISubscriptionTrialCreate {
  restaurantId: string;
  planKey: string;
  trialStart: Date;
  trialEnd: Date;
}

export interface ISubscriptionUpdate {
  planId?: string;
  status?: SubscriptionStatus;
  interval?: BillingInterval;
  trialEndsAt?: Date | null;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  pastDueSince?: Date | null;
  pendingPlanId?: string | null;
  extraBranches?: number;
  extraSeats?: number;
  cancelledAt?: Date | null;
}

export interface ISubscriptionOptions {
  tx?: PrismaTransaction;
}

export abstract class SubscriptionRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findByRestaurantId(restaurantId: string): Promise<IBillingSubscription | null>;
  /** Just the status — the access check runs on every authenticated request, so it must stay cheap. */
  abstract findStatusByRestaurantId(restaurantId: string): Promise<SubscriptionStatus | null>;
  abstract findDetailByRestaurantId(restaurantId: string, options?: ISubscriptionOptions): Promise<ISubscriptionDetail | null>;
  abstract findDetailById(id: string, options?: ISubscriptionOptions): Promise<ISubscriptionDetail | null>;
  /** Live subscriptions whose paid window ends by `periodEndBy` and that have no open renewal charge yet. */
  abstract findDueForInvoicing(periodEndBy: Date): Promise<ISubscriptionDetail[]>;
  /** Every subscription the lifecycle sweep still has to watch (anything not cancelled). */
  abstract findAllLive(): Promise<ILifecycleSubscription[]>;
  abstract update(id: string, data: ISubscriptionUpdate, options?: ISubscriptionOptions): Promise<void>;
  /** Throws if the plan does not exist — a restaurant must never be left without a subscription silently. */
  abstract createTrial(data: ISubscriptionTrialCreate, options?: ISubscriptionOptions): Promise<void>;
}
