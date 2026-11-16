import { Injectable } from "@nestjs/common";
import { AUTH_ERROR_MESSAGES } from "../../../../common/constants";
import { UnauthorizedException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { RestaurantMemberRepository } from "../../../users/domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../../users/domain/repositories/user.repository";
import { BranchRepository } from "../../../branches/domain/repositories/branch.repository";
import { IAuthProfile } from "../../domain/interfaces/auth-session.interface";

/**
 * Re-reads the membership behind a still-valid token, so access revoked five
 * minutes ago stops working now rather than when the token expires.
 */
@Injectable()
export class FetchAuthProfileUsecase {
  constructor(
    private readonly restaurantMemberRepository: RestaurantMemberRepository,
    private readonly branchRepository: BranchRepository,
    private readonly userRepository: UserRepository
  ) {}

  async execute(authEntity: AuthEntity): Promise<IAuthProfile> {
    const memberships = await this.restaurantMemberRepository.findActiveByUserId(authEntity.sub);
    const current = memberships.find(member => member.id === authEntity.memberId);
    if (!current) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);

    // Fresh read, same reasoning as the membership: a branch unassigned minutes ago drops out now.
    const branches = await this.branchRepository.findAccessible(current);
    const user = await this.userRepository.findById(authEntity.sub);

    return {
      id: current.userId,
      name: current.name,
      email: current.email,
      phone: user?.phone ?? null,
      avatarUrl: user?.avatarUrl ?? null,
      hasApprovalPin: current.hasApprovalPin,
      memberId: current.id,
      restaurantId: current.restaurantId,
      role: current.role,
      branchId: authEntity.branchId,
      branches: branches.map(({ id, name, slug, isDefault }) => ({ id, name, slug, isDefault })),
      memberships: memberships.map(member => ({
        memberId: member.id,
        restaurantId: member.restaurantId,
        role: member.role,
      })),
    };
  }
}
