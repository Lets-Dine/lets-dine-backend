import { Injectable } from "@nestjs/common";
import { PrismaTransaction } from "../../../common/prisma";
import { TRIAL_DAYS, TRIAL_PLAN_KEY } from "../domain/constants";
import { SubscriptionRepository } from "../domain/repositories/subscription.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionService {
  constructor(private readonly subscriptionRepository: SubscriptionRepository) {}

  /** Every restaurant gets a subscription the moment it exists, so it is never mistaken for one that predates billing. */
  async startTrial(restaurantId: string, options?: { tx?: PrismaTransaction }): Promise<void> {
    const trialStart = new Date();
    const trialEnd = new Date(trialStart.getTime() + TRIAL_DAYS * DAY_MS);
    await this.subscriptionRepository.createTrial({ restaurantId, planKey: TRIAL_PLAN_KEY, trialStart, trialEnd }, options);
  }
}
