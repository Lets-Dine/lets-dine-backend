import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { BILLING_ERROR_MESSAGES } from "../../domain/constants";
import { ISubscriptionChange } from "../../domain/interfaces/billing.interface";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";

@Injectable()
export class FetchSubscriptionChangesUsecase {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

  async execute(restaurantId: string): Promise<ISubscriptionChange[]> {
    const subscription = await this.subscriptionRepository.findDetailByRestaurantId(restaurantId);
    if (!subscription) throw new NotFoundException(BILLING_ERROR_MESSAGES.SUBSCRIPTION_NOT_FOUND);
    return this.subscriptionRepository.findChanges(subscription.id);
  }
}
