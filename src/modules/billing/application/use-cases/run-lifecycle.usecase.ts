import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SubscriptionStatus } from "@prisma/client";
import { SUBSCRIPTION_LOCKED_EVENT } from "../../domain/constants";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { resolveSubscriptionState } from "../../domain/utils/subscription-lifecycle.util";

const isLocked = (status: SubscriptionStatus): boolean => status === "SUSPENDED" || status === "CANCELLED";

export interface ILifecycleTransition {
  subscriptionId: string;
  restaurantId: string;
  from: SubscriptionStatus;
  to: SubscriptionStatus;
}

export interface IRunLifecycleResult {
  checked: number;
  transitions: ILifecycleTransition[];
}

/**
 * Moves every subscription to the stage it should be at now. A thin loop around
 * the pure `resolveSubscriptionState`, which is where the rules live — and,
 * because that is pure and this is idempotent, a scheduler can call it as-is.
 */
@Injectable()
export class RunLifecycleUsecase {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async execute(now: Date = new Date()): Promise<IRunLifecycleResult> {
    const subscriptions = await this.subscriptionRepository.findAllLive();
    const transitions: ILifecycleTransition[] = [];

    for (const subscription of subscriptions) {
      const next = resolveSubscriptionState(subscription, now);
      if (!next.changed) continue;

      await this.subscriptionRepository.update(subscription.id, {
        status: next.status,
        pastDueSince: next.pastDueSince,
        ...(next.status === "CANCELLED" && { cancelledAt: now }),
      });

      if (next.status !== subscription.status) {
        transitions.push({
          subscriptionId: subscription.id,
          restaurantId: subscription.restaurantId,
          from: subscription.status,
          to: next.status,
        });

        // Staff already connected to the live order pass would otherwise keep it until they disconnect.
        if (isLocked(next.status) && !isLocked(subscription.status)) {
          this.eventEmitter.emit(SUBSCRIPTION_LOCKED_EVENT, { restaurantId: subscription.restaurantId });
        }
      }
    }

    return { checked: subscriptions.length, transitions };
  }
}
