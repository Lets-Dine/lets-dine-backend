import { Injectable } from "@nestjs/common";
import { SubscriptionStatus } from "@prisma/client";
import { PrismaTransaction } from "../../../common/prisma";
import { addInterval } from "../domain/utils/billing-period.util";

/**
 * The first time an invited restaurant pays for a plan, the restaurant that
 * invited them gets one month added to the period they are in now.
 */
@Injectable()
export class ReferralRewardService {
  async grant(inviteeRestaurantId: string, now: Date, tx: PrismaTransaction): Promise<void> {
    const invitee = await tx.restaurant.findUnique({
      where: { id: inviteeRestaurantId },
      select: { referredByRestaurantId: true, referralRewardedAt: true },
    });
    if (!invitee?.referredByRestaurantId || invitee.referralRewardedAt) return;
    if (invitee.referredByRestaurantId === inviteeRestaurantId) return;

    const claimed = await tx.restaurant.updateMany({
      where: { id: inviteeRestaurantId, referralRewardedAt: null, referredByRestaurantId: { not: null } },
      data: { referralRewardedAt: now },
    });
    if (claimed.count !== 1) return;

    const inviter = await tx.subscription.findUnique({
      where: { restaurantId: invitee.referredByRestaurantId },
      select: { id: true, status: true, currentPeriodEnd: true, trialEndsAt: true },
    });
    // A cancelled plan is not brought back by a referral. The reward is already marked, so it is not retried.
    if (!inviter || inviter.status === "CANCELLED") return;

    const currentPeriodEnd = addInterval(inviter.currentPeriodEnd, "MONTHLY");
    await tx.subscription.update({
      where: { id: inviter.id },
      data: {
        currentPeriodEnd,
        ...(inviter.status === "TRIAL" && inviter.trialEndsAt && { trialEndsAt: addInterval(inviter.trialEndsAt, "MONTHLY") }),
        ...(inviter.status === "PAST_DUE" &&
          currentPeriodEnd > now && { status: "ACTIVE" satisfies SubscriptionStatus, pastDueSince: null }),
      },
    });
  }
}
