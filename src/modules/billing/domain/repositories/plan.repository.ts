import { PrismaTransaction } from "../../../../common/prisma";
import { IPlan } from "../interfaces/billing.interface";

export interface IPlanUpdate {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  extraBranchPrice: number | null;
  extraSeatPrice: number | null;
  limits: object;
  features: object;
}

export interface IPlanOptions {
  tx?: PrismaTransaction;
}

export abstract class PlanRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract findByKey(key: string): Promise<IPlan | null>;
  /** Active plans an owner may pick for themselves, cheapest first. */
  abstract findSelfServe(): Promise<IPlan[]>;
  /** Every active plan, public or not, cheapest first — the operator's catalogue. */
  abstract findAllActive(options?: IPlanOptions): Promise<IPlan[]>;
  /** Restaurants currently on each plan (anything not cancelled), keyed by plan key. */
  abstract countRestaurantsByPlanKey(options?: IPlanOptions): Promise<Record<string, number>>;
  abstract updateByKey(key: string, data: IPlanUpdate, options?: IPlanOptions): Promise<void>;
}
