import { Injectable, Logger } from "@nestjs/common";
import { ForbiddenException } from "../../../common/exceptions";
import { BILLING_ERROR_MESSAGES } from "../domain/constants";
import { EntitlementKind, FeatureKey, IEntitlements, IUsage, IUsageMeter } from "../domain/interfaces/billing.interface";
import { SubscriptionRepository } from "../domain/repositories/subscription.repository";
import { UsageRepository } from "../domain/repositories/usage.repository";
import { buildMeter, grandfatheredEntitlements, resolveEntitlements } from "../domain/utils/entitlements.util";

/**
 * The one place plan limits and features are checked. Other modules call this
 * instead of reading plans themselves, so changing how a limit behaves never means
 * hunting through use cases.
 *
 * Failure policy: structural checks (adding a branch or seat) fail closed, while
 * the order path fails open — a billing fault must never stop a restaurant taking orders.
 */
@Injectable()
export class EntitlementService {
  private readonly logger = new Logger(EntitlementService.name);

  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly usageRepository: UsageRepository
  ) {}

  async getEntitlements(restaurantId: string): Promise<IEntitlements> {
    const subscription = await this.subscriptionRepository.findByRestaurantId(restaurantId);
    const now = new Date();
    return subscription ? resolveEntitlements(subscription, now) : grandfatheredEntitlements(now);
  }

  /** Blocks a restricted subscription, and creating (or reactivating) a branch or seat once the plan's limit plus purchased extras is used up. */
  async assertCanCreate(kind: EntitlementKind, restaurantId: string): Promise<void> {
    const entitlements = await this.getEntitlements(restaurantId);
    this.assertNotRestrictedFor(entitlements);

    const limit = kind === "branch" ? entitlements.limits.branches : entitlements.limits.staffSeats;
    if (limit === undefined) return;
    const used =
      kind === "branch"
        ? await this.usageRepository.countActiveBranches(restaurantId)
        : await this.usageRepository.countActiveSeats(restaurantId);
    if (used >= limit) {
      throw new ForbiddenException({ ...BILLING_ERROR_MESSAGES.PLAN_LIMIT_REACHED, detail: { kind, used, limit } });
    }
  }

  async hasFeature(restaurantId: string, feature: FeatureKey): Promise<boolean> {
    const { features } = await this.getEntitlements(restaurantId);
    return feature === "exports" ? features.exports : features.analyticsTier === "full";
  }

  async assertFeature(restaurantId: string, feature: FeatureKey): Promise<void> {
    if (!(await this.hasFeature(restaurantId, feature))) {
      throw new ForbiddenException({ ...BILLING_ERROR_MESSAGES.FEATURE_LOCKED, detail: { feature } });
    }
  }

  /** Guards configuration edits (menu, floors, tables...). Never call it on the order or payment path. */
  async assertNotRestricted(restaurantId: string): Promise<void> {
    this.assertNotRestrictedFor(await this.getEntitlements(restaurantId));
  }

  /**
   * Counts one order against the period's allowance. Soft by design: it reports
   * how close the restaurant is (so the response can nudge an upgrade) but never
   * throws, and a failure here is logged and swallowed.
   */
  async recordOrder(restaurantId: string): Promise<IUsageMeter> {
    try {
      const entitlements = await this.getEntitlements(restaurantId);
      const used = await this.usageRepository.incrementOrderCount(restaurantId, entitlements.periodStart);
      return buildMeter(used, entitlements.limits.ordersPerMonth);
    } catch (error) {
      this.logger.error(
        `Could not record order usage for restaurant ${restaurantId}`,
        error instanceof Error ? error.stack : String(error)
      );
      return { used: 0, level: "ok" };
    }
  }

  /** Everything the owner's usage banner needs, in one read. */
  async getUsage(restaurantId: string): Promise<IUsage> {
    const entitlements = await this.getEntitlements(restaurantId);
    const [orders, branches, seats] = await Promise.all([
      this.usageRepository.getOrderCount(restaurantId, entitlements.periodStart),
      this.usageRepository.countActiveBranches(restaurantId),
      this.usageRepository.countActiveSeats(restaurantId),
    ]);

    return {
      orders: buildMeter(orders, entitlements.limits.ordersPerMonth),
      branches: buildMeter(branches, entitlements.limits.branches),
      seats: buildMeter(seats, entitlements.limits.staffSeats),
    };
  }

  private assertNotRestrictedFor(entitlements: IEntitlements): void {
    if (entitlements.restricted) {
      throw new ForbiddenException({ ...BILLING_ERROR_MESSAGES.SUBSCRIPTION_RESTRICTED, detail: { status: entitlements.status } });
    }
  }
}
