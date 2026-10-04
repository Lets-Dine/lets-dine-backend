import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { can } from "../../../../common/auth";
import { AuthEntity } from "../../../../common/interfaces";
import { BILLING_ERROR_MESSAGES } from "../../domain/constants";
import { ISubscriptionView } from "../../domain/interfaces/billing.interface";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { toSubscriptionView } from "../../domain/utils/plan-view.util";

@Injectable()
export class FetchSubscriptionUsecase {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

  /** A manager gets the plan and its state; the prices in it are for whoever may manage billing. */
  async execute(authEntity: AuthEntity): Promise<ISubscriptionView> {
    const subscription = await this.subscriptionRepository.findDetailByRestaurantId(authEntity.restaurantId);
    if (!subscription) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);
    return toSubscriptionView(subscription, { showPrices: can(authEntity.role, "billing:manage") });
  }
}
