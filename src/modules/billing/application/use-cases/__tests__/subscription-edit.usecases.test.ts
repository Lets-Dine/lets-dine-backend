import { Test } from "@nestjs/testing";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BadRequestException } from "../../../../../common/exceptions";
import { PrismaTransaction } from "../../../../../common/prisma";
import { ISubscriptionDetail } from "../../../domain/interfaces/billing.interface";
import { InvoiceRepository } from "../../../domain/repositories/invoice.repository";
import { SubscriptionRepository } from "../../../domain/repositories/subscription.repository";
import { buildSubscription } from "../../__tests__/billing.fixtures";
import { AdjustSubscriptionUsecase } from "../adjust-subscription.usecase";
import { CancelSubscriptionUsecase } from "../cancel-subscription.usecase";
import { ReactivateSubscriptionUsecase } from "../reactivate-subscription.usecase";

const tx = {} as PrismaTransaction;
const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

async function setup(subscription: ISubscriptionDetail) {
  const module = await Test.createTestingModule({
    providers: [
      AdjustSubscriptionUsecase,
      CancelSubscriptionUsecase,
      ReactivateSubscriptionUsecase,
      {
        provide: SubscriptionRepository,
        useValue: {
          $transaction: jest.fn((fn: (tx: PrismaTransaction) => Promise<unknown>) => fn(tx)),
          findDetailByRestaurantId: jest.fn().mockResolvedValue(subscription),
          findDetailById: jest.fn().mockResolvedValue(subscription),
          update: jest.fn(),
          addChange: jest.fn(),
        },
      },
      { provide: InvoiceRepository, useValue: { voidOpenForSubscription: jest.fn() } },
      { provide: EventEmitter2, useValue: { emit: jest.fn() } },
    ],
  }).compile();
  return {
    adjust: module.get(AdjustSubscriptionUsecase),
    cancel: module.get(CancelSubscriptionUsecase),
    reactivate: module.get(ReactivateSubscriptionUsecase),
    subscriptions: module.get<jest.Mocked<SubscriptionRepository>>(SubscriptionRepository),
    invoices: module.get<jest.Mocked<InvoiceRepository>>(InvoiceRepository),
  };
}

describe("operator subscription edits", () => {
  it("should void open renewals, not everything, when only the discount changes", async () => {
    const { adjust, invoices } = await setup(buildSubscription());

    await adjust.execute("restaurant-1", { reason: "Loyal customer", discountPercent: 20 });

    expect(invoices.voidOpenForSubscription).toHaveBeenCalledWith("sub-1", { tx, kind: "RENEWAL" });
  });

  it("should void all open invoices when the period end moves", async () => {
    const { adjust, invoices } = await setup(buildSubscription());

    await adjust.execute("restaurant-1", { reason: "Goodwill", currentPeriodEnd: future });

    expect(invoices.voidOpenForSubscription).toHaveBeenCalledWith("sub-1", { tx });
  });

  it.each([
    ["a cancelled subscription", buildSubscription({ status: "CANCELLED" }), { discountPercent: 10 }],
    ["both dates", buildSubscription({ status: "TRIAL" }), { trialEndsAt: future, currentPeriodEnd: future }],
    ["a date in the past", buildSubscription(), { currentPeriodEnd: past }],
    ["a period end on a trial", buildSubscription({ status: "TRIAL" }), { currentPeriodEnd: future }],
    ["a period end on a past-due row", buildSubscription({ status: "PAST_DUE" }), { currentPeriodEnd: future }],
  ])("should reject %s", async (_name, subscription, patch) => {
    const { adjust } = await setup(subscription);

    await expect(adjust.execute("restaurant-1", { reason: "Because", ...patch })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("should reject cancelling at period end once the subscription is already unpaid", async () => {
    const { cancel } = await setup(buildSubscription({ status: "RESTRICTED" }));

    await expect(cancel.execute("restaurant-1", { reason: "Closing", when: "PERIOD_END" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("should clear the trial end when reactivating a cancelled subscription", async () => {
    const { reactivate, subscriptions } = await setup(buildSubscription({ status: "CANCELLED", trialEndsAt: past }));

    await reactivate.execute("restaurant-1", { reason: "Came back" });

    expect(subscriptions.update).toHaveBeenCalledWith("sub-1", expect.objectContaining({ status: "ACTIVE", trialEndsAt: null }), { tx });
  });
});
