import { Test, TestingModule } from "@nestjs/testing";
import { PrismaTransaction } from "../../../../common/prisma";
import { TRIAL_DAYS, TRIAL_PLAN_KEY } from "../../domain/constants";
import { SubscriptionRepository } from "../../domain/repositories/subscription.repository";
import { SubscriptionService } from "../subscription.service";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("SubscriptionService", () => {
  let service: SubscriptionService;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: SubscriptionRepository, useValue: { createTrial: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(SubscriptionService);
    subscriptionRepository = module.get(SubscriptionRepository);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("startTrial", () => {
    it("should start the trial plan for the trial length, beginning now", async () => {
      // Arrange
      jest.useFakeTimers().setSystemTime(new Date("2026-03-01T00:00:00.000Z"));

      // Act
      await service.startTrial("restaurant-1");

      // Assert
      expect(subscriptionRepository.createTrial).toHaveBeenCalledWith(
        {
          restaurantId: "restaurant-1",
          planKey: TRIAL_PLAN_KEY,
          trialStart: new Date("2026-03-01T00:00:00.000Z"),
          trialEnd: new Date(new Date("2026-03-01T00:00:00.000Z").getTime() + TRIAL_DAYS * DAY_MS),
        },
        undefined
      );
    });

    it("should pass the caller's transaction through so the trial commits with the restaurant", async () => {
      // Arrange
      const tx = {} as PrismaTransaction;

      // Act
      await service.startTrial("restaurant-1", { tx });

      // Assert
      expect(subscriptionRepository.createTrial).toHaveBeenCalledWith(expect.anything(), { tx });
    });
  });
});
