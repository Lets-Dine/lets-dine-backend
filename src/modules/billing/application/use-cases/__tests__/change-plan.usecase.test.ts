import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { PrismaTransaction } from "../../../../../common/prisma";
import { buildAuthEntity } from "../../../../../common/testing";
import { InvoiceRepository } from "../../../domain/repositories/invoice.repository";
import { PlanRepository } from "../../../domain/repositories/plan.repository";
import { SubscriptionRepository } from "../../../domain/repositories/subscription.repository";
import { buildPlan, buildSubscription } from "../../__tests__/billing.fixtures";
import { ChangePlanUsecase } from "../change-plan.usecase";

const authUser = buildAuthEntity({ restaurantId: "restaurant-1" });
const tx = {} as PrismaTransaction;

const starter = buildPlan({
  id: "plan-starter",
  key: "starter",
  name: "Starter",
  monthlyPrice: 150000,
  annualPrice: 1500000,
  extraBranchPrice: null,
});
const growth = buildPlan();

describe("ChangePlanUsecase", () => {
  let usecase: ChangePlanUsecase;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let planRepository: jest.Mocked<PlanRepository>;
  let invoiceRepository: jest.Mocked<InvoiceRepository>;

  const onStarter = (overrides = {}) => buildSubscription({ plan: starter, ...overrides });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChangePlanUsecase,
        {
          provide: SubscriptionRepository,
          useValue: {
            $transaction: jest.fn((fn: (tx: PrismaTransaction) => Promise<unknown>) => fn(tx)),
            findDetailByRestaurantId: jest.fn().mockResolvedValue(buildSubscription()),
            findDetailById: jest.fn().mockResolvedValue(buildSubscription()),
            update: jest.fn(),
          },
        },
        { provide: PlanRepository, useValue: { findByKey: jest.fn().mockResolvedValue(starter) } },
        { provide: InvoiceRepository, useValue: { voidOpenForSubscription: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(ChangePlanUsecase);
    subscriptionRepository = module.get(SubscriptionRepository);
    planRepository = module.get(PlanRepository);
    invoiceRepository = module.get(InvoiceRepository);
  });

  describe("execute", () => {
    it("should apply an upgrade immediately", async () => {
      // Arrange
      subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(onStarter());
      planRepository.findByKey.mockResolvedValue(growth);

      // Act
      const result = await usecase.execute({ planKey: "growth" }, authUser);

      // Assert
      expect(result.effective).toBe("immediately");
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "sub-1",
        { planId: "plan-growth", pendingPlanId: null, interval: "MONTHLY" },
        { tx }
      );
    });

    it("should queue a downgrade for the end of the paid period instead of applying it", async () => {
      // Arrange — on Growth, ACTIVE, moving to Starter
      planRepository.findByKey.mockResolvedValue(starter);

      // Act
      const result = await usecase.execute({ planKey: "starter" }, authUser);

      // Assert
      expect(result.effective).toBe("next_period");
      expect(subscriptionRepository.update).toHaveBeenCalledWith("sub-1", { pendingPlanId: "plan-starter", interval: "MONTHLY" }, { tx });
    });

    it("should let somebody on a trial pick any plan straight away, including a cheaper one", async () => {
      // Arrange
      subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(buildSubscription({ status: "TRIAL" }));

      // Act
      const result = await usecase.execute({ planKey: "starter" }, authUser);

      // Assert
      expect(result.effective).toBe("immediately");
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "sub-1",
        { planId: "plan-starter", pendingPlanId: null, interval: "MONTHLY" },
        { tx }
      );
    });

    it("should void whatever was open, since it was priced on the old plan", async () => {
      // Act
      await usecase.execute({ planKey: "starter" }, authUser);

      // Assert
      expect(invoiceRepository.voidOpenForSubscription).toHaveBeenCalledWith("sub-1", { tx });
    });

    it("should cancel a queued downgrade when the owner moves back to their current plan", async () => {
      // Arrange
      subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(
        buildSubscription({ pendingPlanId: "plan-starter", pendingPlan: starter })
      );
      planRepository.findByKey.mockResolvedValue(growth);

      // Act
      const result = await usecase.execute({ planKey: "growth" }, authUser);

      // Assert — cancelling a downgrade is not itself one, so it takes effect now
      expect(result.effective).toBe("immediately");
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "sub-1",
        { planId: "plan-growth", pendingPlanId: null, interval: "MONTHLY" },
        { tx }
      );
    });

    it("should change just the billing interval when the plan is the same", async () => {
      // Arrange
      planRepository.findByKey.mockResolvedValue(growth);

      // Act
      await usecase.execute({ planKey: "growth", interval: "ANNUAL" }, authUser);

      // Assert
      expect(subscriptionRepository.update).toHaveBeenCalledWith("sub-1", expect.objectContaining({ interval: "ANNUAL" }), { tx });
    });

    it("should refuse a change to the plan and interval the restaurant is already on", async () => {
      // Arrange
      planRepository.findByKey.mockResolvedValue(growth);

      // Act & Assert
      await expect(usecase.execute({ planKey: "growth" }, authUser)).rejects.toBeInstanceOf(BadRequestException);
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });

    it("should read the subscription of the token's restaurant", async () => {
      // Act
      await usecase.execute({ planKey: "starter" }, authUser);

      // Assert
      expect(subscriptionRepository.findDetailByRestaurantId).toHaveBeenCalledWith("restaurant-1");
    });

    it.each([
      ["a plan that does not exist", null],
      ["a retired plan", buildPlan({ isActive: false })],
    ])("should throw NotFoundException for %s", async (_name, plan) => {
      // Arrange
      planRepository.findByKey.mockResolvedValue(plan);

      // Act & Assert
      await expect(usecase.execute({ planKey: "nope" }, authUser)).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each([
      ["a plan that is not self-service", buildPlan({ key: "enterprise", isPublic: false })],
      ["a usage-priced plan", buildPlan({ key: "pay-per-payment", type: "USAGE" })],
    ])("should refuse %s", async (_name, plan) => {
      // Arrange
      planRepository.findByKey.mockResolvedValue(plan);

      // Act & Assert
      await expect(usecase.execute({ planKey: plan.key }, authUser)).rejects.toBeInstanceOf(BadRequestException);
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when the restaurant has no subscription", async () => {
      // Arrange
      subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute({ planKey: "starter" }, authUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
