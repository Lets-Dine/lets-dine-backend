import { Injectable } from "@nestjs/common";
import { AUTH_ERROR_MESSAGES } from "../../../../common/constants";
import { UnauthorizedException } from "../../../../common/exceptions";
import { IStaffMember } from "../../../users/domain/interfaces/restaurant-member.interface";
import { RestaurantMemberRepository } from "../../../users/domain/repositories/restaurant-member.repository";
import { UserRepository } from "../../../users/domain/repositories/user.repository";
import { verifyPin } from "../../../users/domain/utils/pin.util";
import { IAuthSession } from "../../domain/interfaces/auth-session.interface";
import { SignInStaffInput } from "../../interfaces/http/validations/sign-in-staff.validation";
import { AuthTokenService } from "../auth-token.service";

/**
 * §23 — staff sign in with email + PIN. Every failure answers with the same
 * message: which half was wrong is not the caller's business.
 */
@Injectable()
export class SignInStaffUsecase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly restaurantMemberRepository: RestaurantMemberRepository,
    private readonly authTokenService: AuthTokenService
  ) {}

  async execute(dto: SignInStaffInput): Promise<IAuthSession> {
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
    if (!user.isActive) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);

    const pinMatches = await verifyPin(dto.pin, user.pinHash);
    if (!pinMatches) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);

    const memberships = await this.restaurantMemberRepository.findActiveByUserId(user.id);
    const membership = this.pickMembership(memberships, dto.restaurantId);
    if (!membership) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);

    const accessToken = await this.authTokenService.issue(membership);

    return {
      accessToken,
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        memberId: membership.id,
        restaurantId: membership.restaurantId,
        role: membership.role,
        memberships: memberships.map(member => ({
          memberId: member.id,
          restaurantId: member.restaurantId,
          role: member.role,
        })),
      },
    };
  }

  private pickMembership(memberships: IStaffMember[], restaurantId?: string): IStaffMember | undefined {
    if (!restaurantId) return memberships[0];
    return memberships.find(member => member.restaurantId === restaurantId);
  }
}
