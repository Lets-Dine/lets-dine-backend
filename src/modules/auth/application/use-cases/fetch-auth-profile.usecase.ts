import { Injectable } from "@nestjs/common";
import { AUTH_ERROR_MESSAGES } from "../../../../common/constants";
import { UnauthorizedException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { RestaurantMemberRepository } from "../../../users/domain/repositories/restaurant-member.repository";
import { IAuthProfile } from "../../domain/interfaces/auth-session.interface";

/**
 * Re-reads the membership behind a still-valid token, so access revoked five
 * minutes ago stops working now rather than when the token expires.
 */
@Injectable()
export class FetchAuthProfileUsecase {
  constructor(private readonly restaurantMemberRepository: RestaurantMemberRepository) {}

  async execute(authEntity: AuthEntity): Promise<IAuthProfile> {
    const memberships = await this.restaurantMemberRepository.findActiveByUserId(authEntity.sub);
    const current = memberships.find(member => member.id === authEntity.memberId);
    if (!current) throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);

    return {
      id: current.userId,
      name: current.name,
      email: current.email,
      memberId: current.id,
      restaurantId: current.restaurantId,
      role: current.role,
      memberships: memberships.map(member => ({
        memberId: member.id,
        restaurantId: member.restaurantId,
        role: member.role,
      })),
    };
  }
}
