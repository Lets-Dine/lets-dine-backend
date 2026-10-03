import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../common/exceptions";
import { BRANCH_ERROR_MESSAGES } from "../domain/constants";
import { IBranch } from "../domain/interfaces/branch.interface";
import { BranchRepository } from "../domain/repositories/branch.repository";

/**
 * A branch named by an anonymous diner — by id (from their session) or by slug (browsing before
 * any QR). It must belong to the restaurant and be active; anything else is "not found", never a
 * hint that the branch exists elsewhere. Naming none means the shared, branch-less view.
 */
@Injectable()
export class PublicBranchService {
  constructor(private readonly branchRepository: BranchRepository) {}

  async resolve(restaurantId: string, ref: { branchId?: string; branchSlug?: string }): Promise<IBranch | null> {
    if (!ref.branchId && !ref.branchSlug) return null;

    const branch = ref.branchId
      ? await this.branchRepository.findById(ref.branchId)
      : await this.branchRepository.findBySlug(restaurantId, ref.branchSlug as string);

    if (!branch || branch.restaurantId !== restaurantId || !branch.isActive) throw new NotFoundException(BRANCH_ERROR_MESSAGES.NOT_FOUND);
    return branch;
  }

  /**
   * The branch whose menu to show: the one named, else the restaurant's default. Every branch owns
   * its menu, so "the restaurant's menu" no longer exists on its own — a menu is always some branch's.
   */
  async resolveOrDefault(restaurantId: string, ref: { branchId?: string; branchSlug?: string }): Promise<IBranch> {
    const named = await this.resolve(restaurantId, ref);
    if (named) return named;

    const fallback = await this.branchRepository.findDefault(restaurantId);
    if (!fallback || !fallback.isActive) throw new NotFoundException(BRANCH_ERROR_MESSAGES.NOT_FOUND);
    return fallback;
  }
}
