import { Test, TestingModule } from "@nestjs/testing";
import { SubscriptionStatus } from "@prisma/client";
import { ForbiddenException } from "../../../../common/exceptions";
import { IBillingSubscription } from "../../domain/interfaces/billing.interface";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { UsageRepository } from "../../domain/repositories/usage.repository";
import { EntitlementService } from "../entitlement.service";

const RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";
const PERIOD_START = new Date("2026-03-01T00:00:00.000Z");
const NOW = new Date("2026-03-15T10:00:00.000Z");

const buildSubscription = (overrides: Partial<IBillingSubscription> = {}): IBillingSubscription => ({
  id: "sub-1",
  restaurantId: RESTAURANT_ID,
  status: "ACTIVE" as SubscriptionStatus,
  trialEndsAt: null,
  currentPeriodStart: PERIOD_START,
  currentPeriodEnd: new Date("2026-04-01T00:00:00.000Z"),
  pastDueSince: null,
  extraBranches: 0,
  extraSeats: 0,
  plan: {
    id: "plan-1",
    key: "starter",
    limits: { branches: 1, staffSeats: 5, ordersPerMonth: 100 },
    features: { analyticsTier: "basic", exports: false },
  },
  ...overrides,
});

describe("EntitlementService", () => {
  let service: EntitlementService;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let usageRepository: jest.Mocked<UsageRepository>;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementService,
        { provide: SubscriptionRepository, useValue: { findByRestaurantId: jest.fn().mockResolvedValue(buildSubscription()) } },
        {
          provide: UsageRepository,
          useValue: {
            countActiveBranches: jest.fn().mockResolvedValue(0),
            countActiveSeats: jest.fn().mockResolvedValue(0),
            getOrderCount: jest.fn().mockResolvedValue(0),
            incrementOrderCount: jest.fn().mockResolvedValue(1),
          },
        },
      ],
    }).compile();

    service = module.get(EntitlementService);
    subscriptionRepository = module.get(SubscriptionRepository);
    usageRepository = module.get(UsageRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("assertCanCreate", () => {
    it("should block a branch or seat once the plan's limit is used up", async () => {
      // Arrange — the plan allows 1 branch, 5 seats
      usageRepository.countActiveBranches.mockResolvedValue(1);
      usageRepository.countActiveSeats.mockResolvedValue(5);

      // Act & Assert
      await expect(service.assertCanCreate("branch", RESTAURANT_ID)).rejects.toMatchObject({ exception: { key: "PLAN_LIMIT_REACHED" } });
      await expect(service.assertCanCreate("seat", RESTAURANT_ID)).rejects.toMatchObject({ exception: { key: "PLAN_LIMIT_REACHED" } });
    });

    it("should allow creating while under the limit", async () => {
      // Arrange
      usageRepository.countActiveBranches.mockResolvedValue(0);
      usageRepository.countActiveSeats.mockResolvedValue(4);

      // Act & Assert
      await expect(service.assertCanCreate("branch", RESTAURANT_ID)).resolves.toBeUndefined();
      await expect(service.assertCanCreate("seat", RESTAURANT_ID)).resolves.toBeUndefined();
    });

    it("should block creating anything while the subscription is restricted", async () => {
      // Arrange
      subscriptionRepository.findByRestaurantId.mockResolvedValue(buildSubscription({ status: "RESTRICTED" }));

      // Act & Assert
      await expect(service.assertCanCreate("seat", RESTAURANT_ID)).rejects.toMatchObject({ exception: { key: "SUBSCRIPTION_RESTRICTED" } });
    });

    it("should fail closed when the plan config is malformed", async () => {
      // Arrange
      subscriptionRepository.findByRestaurantId.mockResolvedValue(
        buildSubscription({ plan: { id: "plan-x", key: "broken", limits: { branches: -3 }, features: {} } })
      );

      // Act & Assert
      await expect(service.assertCanCreate("branch", RESTAURANT_ID)).rejects.toThrow();
    });

    it("should leave a restaurant with no subscription unrestricted", async () => {
      // Arrange
      subscriptionRepository.findByRestaurantId.mockResolvedValue(null);

      // Act & Assert
      await expect(service.assertCanCreate("branch", RESTAURANT_ID)).resolves.toBeUndefined();
    });
  });

  describe("features", () => {
    it("should lock full analytics and exports on a basic plan", async () => {
      // Act & Assert
      await expect(service.hasFeature(RESTAURANT_ID, "analyticsFull")).resolves.toBe(false);
      await expect(service.assertFeature(RESTAURANT_ID, "exports")).rejects.toMatchObject({
        exception: { key: "FEATURE_LOCKED", detail: { feature: "exports" } },
      });
    });

    it("should unlock them on a plan that includes them", async () => {
      // Arrange
      subscriptionRepository.findByRestaurantId.mockResolvedValue(
        buildSubscription({ plan: { id: "plan-2", key: "growth", limits: {}, features: { analyticsTier: "full", exports: true } } })
      );

      // Act & Assert
      await expect(service.hasFeature(RESTAURANT_ID, "analyticsFull")).resolves.toBe(true);
      await expect(service.assertFeature(RESTAURANT_ID, "exports")).resolves.toBeUndefined();
    });
  });

  describe("assertNotRestricted", () => {
    it.each(["RESTRICTED", "SUSPENDED", "CANCELLED"] as const)("should block edits when %s", async status => {
      // Arrange
      subscriptionRepository.findByRestaurantId.mockResolvedValue(buildSubscription({ status }));

      // Act & Assert
      await expect(service.assertNotRestricted(RESTAURANT_ID)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it.each(["TRIAL", "ACTIVE", "PAST_DUE"] as const)("should allow edits when %s", async status => {
      // Arrange
      subscriptionRepository.findByRestaurantId.mockResolvedValue(buildSubscription({ status }));

      // Act & Assert
      await expect(service.assertNotRestricted(RESTAURANT_ID)).resolves.toBeUndefined();
    });
  });

  describe("recordOrder", () => {
    it("should count against the current UTC calendar month, whatever the paid window is", async () => {
      // Arrange
      usageRepository.incrementOrderCount.mockResolvedValue(10);

      // Act
      const meter = await service.recordOrder(RESTAURANT_ID);

      // Assert
      expect(usageRepository.incrementOrderCount).toHaveBeenCalledWith(RESTAURANT_ID, PERIOD_START);
      expect(meter).toEqual({ used: 10, limit: 100, level: "ok" });
    });

    it.each([
      [79, "ok"],
      [80, "warn"],
      [99, "warn"],
      [100, "over"],
      [250, "over"],
    ] as const)("should report %s of 100 orders as %s without ever throwing", async (used, level) => {
      // Arrange
      usageRepository.incrementOrderCount.mockResolvedValue(used);

      // Act
      const meter = await service.recordOrder(RESTAURANT_ID);

      // Assert
      expect(meter.level).toBe(level);
    });

    it("should still count orders while the subscription is restricted", async () => {
      // Arrange
      subscriptionRepository.findByRestaurantId.mockResolvedValue(buildSubscription({ status: "SUSPENDED" }));

      // Act
      await service.recordOrder(RESTAURANT_ID);

      // Assert
      expect(usageRepository.incrementOrderCount).toHaveBeenCalled();
    });

    it("should fail open when billing itself is broken", async () => {
      // Arrange
      subscriptionRepository.findByRestaurantId.mockRejectedValue(new Error("db down"));
      jest.spyOn(service["logger"], "error").mockImplementation();

      // Act
      const meter = await service.recordOrder(RESTAURANT_ID);

      // Assert
      expect(meter).toEqual({ used: 0, level: "ok" });
    });
  });

  describe("getUsage", () => {
    it("should assemble the meters for the owner's banner", async () => {
      // Arrange
      usageRepository.getOrderCount.mockResolvedValue(85);
      usageRepository.countActiveBranches.mockResolvedValue(1);
      usageRepository.countActiveSeats.mockResolvedValue(2);

      // Act
      const usage = await service.getUsage(RESTAURANT_ID);

      // Assert
      expect(usage).toEqual({
        orders: { used: 85, limit: 100, level: "warn" },
        branches: { used: 1, limit: 1, level: "over" },
        seats: { used: 2, limit: 5, level: "ok" },
      });
    });
  });
});
