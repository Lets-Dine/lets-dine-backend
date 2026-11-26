import { Injectable } from "@nestjs/common";
import { AUTH_ERROR_MESSAGES } from "../../../common/constants";
import { UnauthorizedException } from "../../../common/exceptions";
import { StaffMembershipPolicy } from "../../../common/auth";
import { RestaurantMemberRepository } from "../domain/repositories/restaurant-member.repository";

/** Users module's answer to "is this token's membership still live?". Asked by AuthGuard on every request. */
@Injectable()
export class ActiveMembershipPolicy extends StaffMembershipPolicy {
  constructor(private readonly restaurantMemberRepository: RestaurantMemberRepository) {
    super();
  }

  async assertIsActiveMember(subject: { memberId: string }): Promise<void> {
    if (!(await this.restaurantMemberRepository.isActiveMember(subject.memberId))) {
      throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_INACTIVE);
    }
  }
}
