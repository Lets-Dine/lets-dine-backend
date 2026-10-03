import { Injectable } from "@nestjs/common";
import { AUTH_ERROR_MESSAGES } from "../../../../common/constants";
import { UnauthorizedException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { RestaurantMemberRepository } from "../../../users/domain/repositories/restaurant-member.repository";
import { IAuthSwitch } from "../../domain/interfaces/auth-session.interface";
import { SwitchBranchInput } from "../../interfaces/http/validations/switch-branch.validation";
import { AuthTokenService } from "../auth-token.service";
import { BranchScopeService } from "../branch-scope.service";
import { toAuthBranches } from "./sign-in-staff.usecase";

/**
 * Re-mints the token with another active branch. Access is re-resolved from the
 * database rather than trusted from the old token, so a revoked assignment can't
 * be used to hop into the branch.
 */
@Injectable()
export class SwitchBranchUsecase {
  constructor(
    private readonly restaurantMemberRepository: RestaurantMemberRepository,
    private readonly branchScopeService: BranchScopeService,
    private readonly authTokenService: AuthTokenService
  ) {}

  async execute(dto: SwitchBranchInput, authEntity: AuthEntity): Promise<IAuthSwitch> {
    const memberships = await this.restaurantMemberRepository.findActiveByUserId(authEntity.sub);
    const member = memberships.find(candidate => candidate.id === authEntity.memberId);
    if (!member) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);

    const scope = await this.branchScopeService.resolve(member, dto.branchId);
    const accessToken = await this.authTokenService.issue(member, { branchId: scope.active.id, branchIds: scope.branchIds });

    return { accessToken, branchId: scope.active.id, branches: toAuthBranches(scope) };
  }
}
