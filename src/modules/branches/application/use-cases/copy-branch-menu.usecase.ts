import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { BRANCH_ERROR_MESSAGES } from "../../domain/constants";
import { IBranch } from "../../domain/interfaces/branch.interface";
import { BranchMenuRepository, IMenuCopyResult } from "../../domain/repositories/branch-menu.repository";
import { BranchRepository } from "../../domain/repositories/branch.repository";

/** Starts a branch's menu from another branch's — an owner-only setup step, never a sync: the two menus are independent afterwards. */
@Injectable()
export class CopyBranchMenuUsecase {
  constructor(
    private readonly branchRepository: BranchRepository,
    private readonly branchMenuRepository: BranchMenuRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(toBranchId: string, fromBranchId: string, authEntity: AuthEntity): Promise<IMenuCopyResult> {
    if (toBranchId === fromBranchId) throw new BadRequestException(BRANCH_ERROR_MESSAGES.COPY_SAME_BRANCH);

    const [to, from] = await Promise.all([this.branchRepository.findById(toBranchId), this.branchRepository.findById(fromBranchId)]);
    const mine = (branch: IBranch | null): branch is IBranch => Boolean(branch) && branch?.restaurantId === authEntity.restaurantId;
    if (!mine(to) || !mine(from)) throw new NotFoundException(BRANCH_ERROR_MESSAGES.NOT_FOUND);

    // Copying over an existing menu would silently merge two menus' names and slugs — start from empty or not at all.
    if (!(await this.branchMenuRepository.isMenuEmpty(toBranchId))) throw new ConflictException(BRANCH_ERROR_MESSAGES.MENU_NOT_EMPTY);

    const result = await this.branchMenuRepository.copyMenu(fromBranchId, toBranchId, authEntity.sub);

    await this.auditLogService.record(
      {
        action: AuditAction.branch_updated,
        subject: to.name,
        detail: `Menu copied from ${from.name} — ${result.dishes} dishes, ${result.categories} sections, ${result.addOns} add-ons`,
      },
      authEntity
    );

    return result;
  }
}
