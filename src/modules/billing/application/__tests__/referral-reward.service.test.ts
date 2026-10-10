import { PrismaTransaction } from "../../../../common/prisma";
import { ReferralRewardService } from "../referral-reward.service";

const NOW = new Date("2026-03-28T00:00:00.000Z");
const PERIOD_END = new Date("2026-04-01T00:00:00.000Z");

interface Invitee {
  referredByRestaurantId: string | null;
  referralRewardedAt: Date | null;
}

interface Inviter {
  id: string;
  status: "ACTIVE" | "TRIAL" | "PAST_DUE" | "CANCELLED";
  currentPeriodEnd: Date;
  trialEndsAt: Date | null;
}

function buildTx(invitee: Invitee | null, inviter: Inviter | null, claimed = 1) {
  const update = jest.fn();
  const tx = {
    restaurant: {
      findUnique: jest.fn().mockResolvedValue(invitee),
      updateMany: jest.fn().mockResolvedValue({ count: claimed }),
    },
    subscription: {
      findUnique: jest.fn().mockResolvedValue(inviter),
      update,
    },
  };
  return { tx: tx as unknown as PrismaTransaction, update, updateMany: tx.restaurant.updateMany };
}

describe("ReferralRewardService", () => {
  const service = new ReferralRewardService();

  it("should add one month to the inviter's current period and mark the reward once", async () => {
    const { tx, update, updateMany } = buildTx(
      { referredByRestaurantId: "inviter-restaurant", referralRewardedAt: null },
      { id: "sub-inviter", status: "ACTIVE", currentPeriodEnd: PERIOD_END, trialEndsAt: null }
    );

    await service.grant("invitee-restaurant", NOW, tx);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "invitee-restaurant", referralRewardedAt: null, referredByRestaurantId: { not: null } },
      data: { referralRewardedAt: NOW },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "sub-inviter" },
      data: { currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z") },
    });
  });

  it("should extend a trial by one month as well", async () => {
    const { tx, update } = buildTx(
      { referredByRestaurantId: "inviter-restaurant", referralRewardedAt: null },
      { id: "sub-inviter", status: "TRIAL", currentPeriodEnd: PERIOD_END, trialEndsAt: PERIOD_END }
    );

    await service.grant("invitee-restaurant", NOW, tx);

    expect(update).toHaveBeenCalledWith({
      where: { id: "sub-inviter" },
      data: {
        currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
        trialEndsAt: new Date("2026-05-01T00:00:00.000Z"),
      },
    });
  });

  it("should bring a past-due inviter back to active when the extra month reaches past today", async () => {
    const { tx, update } = buildTx(
      { referredByRestaurantId: "inviter-restaurant", referralRewardedAt: null },
      { id: "sub-inviter", status: "PAST_DUE", currentPeriodEnd: new Date("2026-03-20T00:00:00.000Z"), trialEndsAt: null }
    );

    await service.grant("invitee-restaurant", NOW, tx);

    expect(update).toHaveBeenCalledWith({
      where: { id: "sub-inviter" },
      data: {
        currentPeriodEnd: new Date("2026-04-20T00:00:00.000Z"),
        status: "ACTIVE",
        pastDueSince: null,
      },
    });
  });

  it("should not change a cancelled inviter, and should not try again later", async () => {
    const { tx, update, updateMany } = buildTx(
      { referredByRestaurantId: "inviter-restaurant", referralRewardedAt: null },
      { id: "sub-inviter", status: "CANCELLED", currentPeriodEnd: PERIOD_END, trialEndsAt: null }
    );

    await service.grant("invitee-restaurant", NOW, tx);

    expect(updateMany).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["nobody was invited", null],
    ["the reward was already given", { referredByRestaurantId: "inviter-restaurant", referralRewardedAt: NOW }],
    ["there is no inviter", { referredByRestaurantId: null, referralRewardedAt: null }],
  ] as const)("should do nothing when %s", async (_label, invitee) => {
    const { tx, update, updateMany } = buildTx(invitee, null);

    await service.grant("invitee-restaurant", NOW, tx);

    expect(updateMany).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("should not extend the period when another payment already claimed the reward", async () => {
    const { tx, update } = buildTx(
      { referredByRestaurantId: "inviter-restaurant", referralRewardedAt: null },
      { id: "sub-inviter", status: "ACTIVE", currentPeriodEnd: PERIOD_END, trialEndsAt: null },
      0
    );

    await service.grant("invitee-restaurant", NOW, tx);

    expect(update).not.toHaveBeenCalled();
  });
});
