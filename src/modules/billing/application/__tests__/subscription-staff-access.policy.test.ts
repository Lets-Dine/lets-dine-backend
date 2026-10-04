import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "../../../../common/exceptions";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { SubscriptionStaffAccessPolicy } from "../subscription-staff-access.policy";

const manager = { restaurantId: "restaurant-1", role: "MANAGER" } as const;
const owner = { restaurantId: "restaurant-1", role: "OWNER" } as const;

describe("SubscriptionStaffAccessPolicy", () => {
  let policy: SubscriptionStaffAccessPolicy;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionStaffAccessPolicy,
        { provide: SubscriptionRepository, useValue: { findStatusByRestaurantId: jest.fn().mockResolvedValue("ACTIVE") } },
      ],
    }).compile();

    policy = module.get(SubscriptionStaffAccessPolicy);
    subscriptionRepository = module.get(SubscriptionRepository);
  });

  describe("assertCanAccess", () => {
    it("should look up only the status of the member's own restaurant", async () => {
      // Act
      await policy.assertCanAccess(manager);

      // Assert
      expect(subscriptionRepository.findStatusByRestaurantId).toHaveBeenCalledWith("restaurant-1");
    });

    it("should let staff in while the subscription is working", async () => {
      // Act & Assert
      await expect(policy.assertCanAccess(manager)).resolves.toBeUndefined();
    });

    it("should refuse a manager of a suspended restaurant with SUBSCRIPTION_SUSPENDED and the status", async () => {
      // Arrange
      subscriptionRepository.findStatusByRestaurantId.mockResolvedValue("SUSPENDED");

      // Act
      const attempt = policy.assertCanAccess(manager, { allowedWhenSuspended: true });

      // Assert
      await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
      await expect(attempt).rejects.toMatchObject({ exception: { key: "SUBSCRIPTION_SUSPENDED", detail: { status: "SUSPENDED" } } });
    });

    it("should let the owner of a suspended restaurant reach a route marked for owners, but nothing else", async () => {
      // Arrange
      subscriptionRepository.findStatusByRestaurantId.mockResolvedValue("SUSPENDED");

      // Act & Assert
      await expect(policy.assertCanAccess(owner, { allowedWhenSuspended: true })).resolves.toBeUndefined();
      await expect(policy.assertCanAccess(owner)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("should treat a cancelled restaurant like a suspended one", async () => {
      // Arrange
      subscriptionRepository.findStatusByRestaurantId.mockResolvedValue("CANCELLED");

      // Act & Assert
      await expect(policy.assertCanAccess(manager)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("should let staff in when the restaurant has no subscription", async () => {
      // Arrange
      subscriptionRepository.findStatusByRestaurantId.mockResolvedValue(null);

      // Act & Assert
      await expect(policy.assertCanAccess(manager)).resolves.toBeUndefined();
    });
  });
});
