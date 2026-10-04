import { Injectable } from "@nestjs/common";
import { StaffAccessPolicy } from "../../../../common/auth";
import { AUTH_ERROR_MESSAGES } from "../../../../common/constants";
import { ForbiddenException, UnauthorizedException } from "../../../../common/exceptions";
import { IStaffMember } from "../../../users/domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../../users/domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../../users/domain/repositories/user.repository";
import { verifyPin } from "../../../users/domain/utils/pin.util";
import { IAuthSession } from "../../domain/interfaces/auth-session.interface";
import { SignInStaffInput } from "../../interfaces/http/validations/sign-in-staff.validation";
import { AuthTokenService } from "../auth-token.service";
import { BranchScopeService, IBranchScope } from "../branch-scope.service";

/**
 * §23 — staff sign in with email + PIN. Every failure answers with the same
 * message: which half was wrong is not the caller's business.
 */
@Injectable()
export class SignInStaffUsecase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly restaurantMemberRepository: RestaurantMemberRepository,
    private readonly authTokenService: AuthTokenService,
    private readonly branchScopeService: BranchScopeService,
    private readonly staffAccessPolicy: StaffAccessPolicy
  ) {}

  async execute(dto: SignInStaffInput): Promise<IAuthSession> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    if (!user.isActive) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);

    const pinMatches = await verifyPin(dto.pin, user.pinHash);
    if (!pinMatches) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);

    const memberships = await this.restaurantMemberRepository.findActiveByUserId(user.id);
    const membership = await this.pickMembership(memberships, dto.restaurantId);
    if (!membership) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);

    const scope = await this.branchScopeService.resolve(membership, dto.branchId);
    const accessToken = await this.authTokenService.issue(membership, { branchId: scope.active.id, branchIds: scope.branchIds });

    return {
      accessToken,
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        memberId: membership.id,
        restaurantId: membership.restaurantId,
        role: membership.role,
        branchId: scope.active.id,
        branches: toAuthBranches(scope),
        memberships: memberships.map(member => ({
          memberId: member.id,
          restaurantId: member.restaurantId,
          role: member.role,
        })),
      },
    };
  }

  /**
   * Asked for a restaurant, that one or nothing. Not asked, the first restaurant the person can actually
   * get into — somebody on two teams is not locked out of the working one by the other's suspension. If
   * every candidate is locked out, the first one's reason is what they are told. An owner always passes
   * here (`allowedWhenSuspended`): signing in is how they get to billing to restore the account.
   */
  private async pickMembership(memberships: IStaffMember[], restaurantId?: string): Promise<IStaffMember | undefined> {
    const candidates = restaurantId ? memberships.filter(member => member.restaurantId === restaurantId) : memberships;

    let lockedOut: ForbiddenException | undefined;
    for (const candidate of candidates) {
      try {
        await this.staffAccessPolicy.assertCanAccess(candidate, { allowedWhenSuspended: true });
        return candidate;
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
        lockedOut ??= error;
      }
    }

    if (lockedOut) throw lockedOut;
    return undefined;
  }
}

export function toAuthBranches(scope: IBranchScope) {
  return scope.branches.map(({ id, name, slug, isDefault }) => ({ id, name, slug, isDefault }));
}
