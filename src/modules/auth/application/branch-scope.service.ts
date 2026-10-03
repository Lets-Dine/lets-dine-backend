import { Injectable } from "@nestjs/common";
import { StaffRole } from "@prisma/client";
import { AUTH_ERROR_MESSAGES } from "../../../common/constants";
import { ForbiddenException, UnauthorizedException } from "../../../common/exceptions";
import { IBranch } from "../../branches/domain/interfaces/branch.interface";
import { BranchRepository } from "../../branches/domain/repositories/branch.repository";
import { IStaffMember } from "../../users/domain/interfaces/restaurant-member.interface";

export interface IBranchScope {
  /** Every active branch the member may work in. */
  branches: IBranch[];
  /** The one the session starts in. */
  active: IBranch;
  /** What goes into the token: `"all"` for an OWNER so branches created later are covered. */
  branchIds: string[] | "all";
}

/** Decides which branches a membership reaches and which one a session is working in. */
@Injectable()
export class BranchScopeService {
  constructor(private readonly branchRepository: BranchRepository) {}

  async resolve(member: IStaffMember, requestedBranchId?: string): Promise<IBranchScope> {
    const branches = await this.branchRepository.findAccessible(member);
    if (branches.length === 0) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.NO_BRANCH_ACCESS);

    // `findAccessible` lists the default branch first, so the fallback prefers it.
    const active = requestedBranchId ? branches.find(branch => branch.id === requestedBranchId) : branches[0];
    if (!active) throw new ForbiddenException(AUTH_ERROR_MESSAGES.FORBIDDEN);

    return {
      branches,
      active,
      branchIds: member.role === StaffRole.OWNER ? "all" : branches.map(branch => branch.id),
    };
  }
}
