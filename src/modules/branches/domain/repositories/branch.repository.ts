import { StaffRole } from "@prisma/client";
import { IPaginationOptions, PaginatedResponse } from "../../../../common/interfaces";
import { PrismaTransaction } from "../../../../common/prisma";
import { IBranch, IBranchHours, IBranchWithHours } from "../interfaces/branch.interface";

export interface IBranchCreate {
  restaurantId: string;
  name: string;
  slug: string;
  address?: string;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string;
  serviceChargeRate?: number | null;
  taxRate?: number | null;
  deliveryFeeAmount?: number | null;
  autoConsumeStock?: boolean | null;
  isDefault?: boolean;
}

export type IBranchUpdate = Partial<Omit<IBranchCreate, "restaurantId" | "isDefault">> & { isActive?: boolean };

export type IBranchHoursInput = Pick<IBranchHours, "dayOfWeek" | "opensAt" | "closesAt" | "isClosed">;

export interface BranchFetchOptions {
  tx?: PrismaTransaction;
}

export interface IBranchesFetchQuery {
  restaurantId: string;
  /** Restrict to these branches (managers/staff). Undefined = every branch (owner). */
  branchIds?: string[];
  keyword?: string;
  isActive?: boolean;
}

export interface IBranchesFetchOptions extends IPaginationOptions {
  tx?: PrismaTransaction;
}

export abstract class BranchRepository {
  abstract findById(id: string, options?: BranchFetchOptions): Promise<IBranchWithHours | null>;
  abstract findBySlug(restaurantId: string, slug: string, options?: BranchFetchOptions): Promise<IBranch | null>;
  /** Active branches a member may work in: every one for an OWNER, otherwise their `BranchMember` rows. */
  abstract findAccessible(member: { id: string; restaurantId: string; role: StaffRole }, options?: BranchFetchOptions): Promise<IBranch[]>;
  /** The active branches of this restaurant among `ids` — ids from other restaurants never match. */
  abstract findActiveByIds(restaurantId: string, ids: string[], options?: BranchFetchOptions): Promise<IBranch[]>;
  /** Every active branch of the restaurant with its weekly schedule — the public branch list. */
  abstract findActiveWithHours(restaurantId: string, options?: BranchFetchOptions): Promise<IBranchWithHours[]>;
  abstract findDefault(restaurantId: string, options?: BranchFetchOptions): Promise<IBranch | null>;
  abstract create(data: IBranchCreate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IBranch>;
  abstract update(id: string, data: IBranchUpdate, options?: { tx?: PrismaTransaction; actorId?: string }): Promise<IBranch>;
  abstract fetchAll(query: IBranchesFetchQuery, options?: IBranchesFetchOptions): Promise<PaginatedResponse<IBranch>>;
  /** Replaces the whole weekly schedule atomically. */
  abstract replaceHours(branchId: string, hours: IBranchHoursInput[], options?: { tx?: PrismaTransaction }): Promise<IBranchHours[]>;
}
