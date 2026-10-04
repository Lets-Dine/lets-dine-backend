import { Injectable } from "@nestjs/common";
import { IStaffAccessSubject, StaffAccessPolicy } from "../../../common/auth";
import { ForbiddenException } from "../../../common/exceptions";
import { BILLING_ERROR_MESSAGES } from "../domain/constants";
import { SubscriptionRepository } from "../domain/repositories/subscription.repository";
import { isStaffLockedOut } from "../domain/utils/staff-lockout.util";

/**
 * Billing's answer to "may this staff member be in the app?": not while the
 * restaurant's subscription is suspended or cancelled, bar the owner on the routes
 * they need to get it restored.
 */
@Injectable()
export class SubscriptionStaffAccessPolicy extends StaffAccessPolicy {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {
    super();
  }

  async assertCanAccess(subject: IStaffAccessSubject, options?: { allowedWhenSuspended?: boolean }): Promise<void> {
    const status = await this.subscriptionRepository.findStatusByRestaurantId(subject.restaurantId);

    if (isStaffLockedOut(status, subject.role, options?.allowedWhenSuspended ?? false)) {
      throw new ForbiddenException({ ...BILLING_ERROR_MESSAGES.SUBSCRIPTION_SUSPENDED, detail: { status } });
    }
  }
}
