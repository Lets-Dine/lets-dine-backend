import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { InvoiceRepository } from "../../../domain/repositories/invoice.repository";
import { PlanRepository } from "../../../domain/repositories/plan.repository";
import { SubscriptionRepository } from "../../../domain/repositories/subscription.repository";
import { buildPlan, buildSubscription } from "../../__tests__/billing.fixtures";
import { EntitlementService } from "../../entitlement.service";
import { FetchInvoicesUsecase } from "../fetch-invoices.usecase";
import { FetchPlansUsecase } from "../fetch-plans.usecase";
import { FetchPlatformInvoicesUsecase } from "../fetch-platform-invoices.usecase";
import { FetchSubscriptionUsecase } from "../fetch-subscription.usecase";
import { FetchUsageUsecase } from "../fetch-usage.usecase";

const authUser = buildAuthEntity({ restaurantId: "restaurant-1" });
const page = { rows: [], count: 0 };

describe("billing read use cases", () => {
  let module: TestingModule;
  let invoiceRepository: jest.Mocked<InvoiceRepository>;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let planRepository: jest.Mocked<PlanRepository>;
  let entitlementService: jest.Mocked<EntitlementService>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        FetchInvoicesUsecase,
        FetchPlatformInvoicesUsecase,
        FetchSubscriptionUsecase,
        FetchPlansUsecase,
        FetchUsageUsecase,
        { provide: InvoiceRepository, useValue: { fetchAll: jest.fn().mockResolvedValue(page) } },
        { provide: SubscriptionRepository, useValue: { findDetailByRestaurantId: jest.fn() } },
        { provide: PlanRepository, useValue: { findSelfServe: jest.fn() } },
        { provide: EntitlementService, useValue: { getUsage: jest.fn() } },
      ],
    }).compile();

    invoiceRepository = module.get(InvoiceRepository);
    subscriptionRepository = module.get(SubscriptionRepository);
    planRepository = module.get(PlanRepository);
    entitlementService = module.get(EntitlementService);
  });

  describe("FetchInvoicesUsecase", () => {
    it("should scope to the token's restaurant and keep the pagination, ignoring any restaurant a client might send", async () => {
      // Act
      const result = await module
        .get(FetchInvoicesUsecase)
        .execute({ limit: 10, offset: 0, returnData: true, returnCount: true }, authUser);

      // Assert
      expect(result).toBe(page);
      expect(invoiceRepository.fetchAll).toHaveBeenCalledWith(
        { restaurantId: "restaurant-1" },
        { limit: 10, offset: 0, returnData: true, returnCount: true }
      );
    });
  });

  describe("FetchPlatformInvoicesUsecase", () => {
    it("should pass the filters through and keep pagination separate from them", async () => {
      // Act
      await module
        .get(FetchPlatformInvoicesUsecase)
        .execute({ restaurantId: "restaurant-2", status: "OPEN", limit: 5, returnData: true, returnCount: true });

      // Assert
      expect(invoiceRepository.fetchAll).toHaveBeenCalledWith(
        { restaurantId: "restaurant-2", status: "OPEN" },
        { limit: 5, returnData: true, returnCount: true }
      );
    });
  });

  describe("FetchSubscriptionUsecase", () => {
    it("should return the token's restaurant's subscription with its plan parsed and the internal pending-plan id folded away", async () => {
      // Arrange
      subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(
        buildSubscription({ pendingPlanId: "plan-starter", pendingPlan: buildPlan({ key: "starter" }) })
      );

      // Act
      const view = await module.get(FetchSubscriptionUsecase).execute(authUser);

      // Assert
      expect(subscriptionRepository.findDetailByRestaurantId).toHaveBeenCalledWith("restaurant-1");
      expect(view.plan.limits).toEqual({ branches: 5, staffSeats: 20, ordersPerMonth: 10000 });
      expect(view.plan).not.toHaveProperty("id");
      expect(view.pendingPlan?.key).toBe("starter");
      expect(view).not.toHaveProperty("pendingPlanId");
    });

    it("should show an owner what the plan costs", async () => {
      // Arrange
      subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(buildSubscription());

      // Act
      const view = await module.get(FetchSubscriptionUsecase).execute(authUser);

      // Assert
      expect(view.plan).toMatchObject({ monthlyPrice: 400000, annualPrice: 4000000, extraBranchPrice: 80000 });
    });

    it("should show a manager the plan and its state but none of the prices, queued plan included", async () => {
      // Arrange
      const manager = buildAuthEntity({ restaurantId: "restaurant-1", role: "MANAGER" });
      subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(
        buildSubscription({ pendingPlanId: "plan-starter", pendingPlan: buildPlan({ key: "starter", monthlyPrice: 150000 }) })
      );

      // Act
      const view = await module.get(FetchSubscriptionUsecase).execute(manager);

      // Assert
      expect(view.plan).toMatchObject({
        key: "growth",
        name: "Growth",
        monthlyPrice: null,
        annualPrice: null,
        extraBranchPrice: null,
        extraSeatPrice: null,
      });
      expect(view.plan.limits).toEqual({ branches: 5, staffSeats: 20, ordersPerMonth: 10000 });
      expect(view.pendingPlan).toMatchObject({ key: "starter", monthlyPrice: null });
      expect(view.status).toBe("ACTIVE");
    });

    it("should throw NotFoundException when there is no subscription", async () => {
      // Arrange
      subscriptionRepository.findDetailByRestaurantId.mockResolvedValue(null);

      // Act & Assert
      await expect(module.get(FetchSubscriptionUsecase).execute(authUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("FetchPlansUsecase", () => {
    it("should return the self-serve plans with their JSON parsed", async () => {
      // Arrange
      planRepository.findSelfServe.mockResolvedValue([buildPlan()]);

      // Act
      const plans = await module.get(FetchPlansUsecase).execute();

      // Assert
      expect(plans).toHaveLength(1);
      expect(plans[0]).toMatchObject({ key: "growth", features: { analyticsTier: "full", exports: true } });
      expect(plans[0]).not.toHaveProperty("id");
    });
  });

  describe("FetchUsageUsecase", () => {
    it("should read the usage of the token's restaurant", async () => {
      // Arrange
      const usage = { orders: { used: 1, level: "ok" } } as any;
      entitlementService.getUsage.mockResolvedValue(usage);

      // Act
      const result = await module.get(FetchUsageUsecase).execute(authUser);

      // Assert
      expect(result).toBe(usage);
      expect(entitlementService.getUsage).toHaveBeenCalledWith("restaurant-1");
    });
  });
});
