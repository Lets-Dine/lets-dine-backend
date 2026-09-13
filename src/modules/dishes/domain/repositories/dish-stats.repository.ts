import { PrismaTransaction } from "../../../../common/prisma";
import { IDishStats } from "../interfaces/dish-stats.interface";

export interface DishStatsFetchOptions {
  tx?: PrismaTransaction;
  /** Length of each ordering window, in days. §12 uses 30 and the 30 before it. */
  windowDays?: number;
}

export abstract class DishStatsRepository {
  /** Stats for many dishes at once — a menu screen must not fan out per dish. */
  abstract fetchStatsFor(dishIds: string[], options?: DishStatsFetchOptions): Promise<Map<string, IDishStats>>;
}
