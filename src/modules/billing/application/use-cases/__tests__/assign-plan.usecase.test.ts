import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "../../../../../common/exceptions";
import { PrismaTransaction } from "../../../../../common/prisma";
import { InvoiceRepository } from "../../../domain/repositories/invoice.repository";
import { PlanRepository } from "../../../domain/repositories/plan.repository";
import { SubscriptionRepository } from "../../../domain/repositories/subscription.repository";
import { buildPlan, buildSubscription } from "../../__tests__/billing.fixtures";
import { AssignPlanUsecase } from "../assign-plan.usecase";

const tx = {} as PrismaTransaction;
const enterprise = buildPlan({
  id: "plan-enterprise",
  key: "enterprise",
  name: "Enterprise",
  isPublic: false,
  monthlyPrice: 0,
  extraBranchPrice: 100000,
});

describe("AssignPlanUsecase", () => {
  let usecase: AssignPlanUsecase;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let planRepository: jest.Mocked<PlanRepository>;
  let invoiceRepository: jest.Mocked<InvoiceRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignPlanUsecase,
        {
          provide: SubscriptionRepository,
          useValue: {
            $transaction: jest.fn((fn: (tx: PrismaTransaction) => Promise<unknown>) => fn(tx)),
            findDetailByRestaurantId: jest.fn().mockResolvedValue(buildSubscription()),
            findDetailById: jest.fn().mockResolvedValue(buildSubscription({ plan: enterprise })),
            update: jest.fn(),
          },
        },
        { provide: PlanRepository, useValue: { findByKey: jest.fn().mockResolvedValue(enterprise) } },
        { provide: InvoiceRepository, useValue: { voidOpenForSubscription: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(AssignPlanUsecase);
    subscriptionRepository = module.get(SubscriptionRepository);
    planRepository = module.get(PlanRepository);
    invoiceRepository = module.get(InvoiceRepository);
  });

  describe("execute", () => {
    it("should put a restaurant on a plan that owners cannot pick themselves, effective immediately", async () => {
      // Act
      const view = await usecase.execute("restaurant-1", { planKey: "enterprise" });

      // Assert
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "sub-1",
        { planId: "plan-enterprise", pendingPlanId: null, interval: "MONTHLY", extraBranches: 0, extraSeats: 0 },
        { tx }
      );
      expect(view.plan.key).toBe("enterprise");
    });

    it("should set purchased extras and void what was open, since it was priced without them", async () => {
      // Act
      await usecase.execute("restaurant-1", { planKey: "enterprise", extraBranches: 3 });

      // Assert
      expect(subscriptionRepository.update).toHaveBeenCalledWith("sub-1", expect.objectContaining({ extraBranches: 3 }), { tx });
      expect(invoiceRepository.voidOpenForSubscription).toHaveBeenCalledWith("sub-1", { tx });
    });

    it("should keep the extras the restaurant already has when none are given", async () => {
      // Arrange
      subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(buildSubscription({ extraBranches: 2 }));

      // Act
      await usecase.execute("restaurant-1", { planKey: "enterprise" });

      // Assert
      expect(subscriptionRepository.update).toHaveBeenCalledWith("sub-1", expect.objectContaining({ extraBranches: 2 }), { tx });
    });

    it("should refuse extras on a plan that has no price for them, rather than giving them away", async () => {
      // Arrange — the fixture growth plan has no seat price
      planRepository.findByKey.mockResolvedValue(buildPlan());

      // Act & Assert
      await expect(usecase.execute("restaurant-1", { planKey: "growth", extraSeats: 2 })).rejects.toBeInstanceOf(BadRequestException);
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException for an unknown or retired plan", async () => {
      // Arrange
      planRepository.findByKey.mockResolvedValue(buildPlan({ isActive: false }));

      // Act & Assert
      await expect(usecase.execute("restaurant-1", { planKey: "growth" })).rejects.toBeInstanceOf(NotFoundException);
    });

    it("should throw NotFoundException for a restaurant with no subscription", async () => {
      // Arrange
      subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(null);

      // Act & Assert
      await expect(usecase.execute("restaurant-9", { planKey: "enterprise" })).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
