import { EventEmitter2 } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";
import { SUBSCRIPTION_LOCKED_EVENT } from "../../../domain/constants";
import { ILifecycleSubscription } from "../../../domain/interfaces/billing.interface";
import { SubscriptionRepository } from "../../../domain/repositories/subscription.repository";
import { RunLifecycleUsecase } from "../run-lifecycle.usecase";

const NOW = new Date("2026-03-28T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

const live = (overrides: Partial<ILifecycleSubscription> = {}): ILifecycleSubscription => ({
  id: "sub-1",
  restaurantId: "restaurant-1",
  status: "ACTIVE",
  trialEndsAt: null,
  currentPeriodEnd: new Date("2026-04-15T00:00:00.000Z"),
  pastDueSince: null,
  ...overrides,
});

describe("RunLifecycleUsecase", () => {
  let usecase: RunLifecycleUsecase;
  let subscriptionRepository: jest.Mocked<SubscriptionRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunLifecycleUsecase,
        { provide: SubscriptionRepository, useValue: { findAllLive: jest.fn().mockResolvedValue([]), update: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    usecase = module.get(RunLifecycleUsecase);
    subscriptionRepository = module.get(SubscriptionRepository);
    eventEmitter = module.get(EventEmitter2);
  });

  describe("execute", () => {
    it("should leave subscriptions that are where they should be untouched", async () => {
      // Arrange
      subscriptionRepository.findAllLive.mockResolvedValue([live()]);

      // Act
      const result = await usecase.execute(NOW);

      // Assert
      expect(result).toEqual({ checked: 1, transitions: [] });
      expect(subscriptionRepository.update).not.toHaveBeenCalled();
    });

    it("should move an unpaid active subscription to past due and report the transition", async () => {
      // Arrange
      const lapsed = live({ currentPeriodEnd: daysAgo(2) });
      subscriptionRepository.findAllLive.mockResolvedValue([lapsed]);

      // Act
      const result = await usecase.execute(NOW);

      // Assert
      expect(subscriptionRepository.update).toHaveBeenCalledWith("sub-1", { status: "PAST_DUE", pastDueSince: lapsed.currentPeriodEnd });
      expect(result.transitions).toEqual([{ subscriptionId: "sub-1", restaurantId: "restaurant-1", from: "ACTIVE", to: "PAST_DUE" }]);
    });

    it("should restrict a trial that has ended", async () => {
      // Arrange
      subscriptionRepository.findAllLive.mockResolvedValue([live({ status: "TRIAL", trialEndsAt: daysAgo(1) })]);

      // Act
      const result = await usecase.execute(NOW);

      // Assert
      expect(result.transitions[0]).toMatchObject({ from: "TRIAL", to: "RESTRICTED" });
    });

    it("should stamp cancelledAt when a subscription reaches cancelled", async () => {
      // Arrange
      subscriptionRepository.findAllLive.mockResolvedValue([live({ status: "SUSPENDED", pastDueSince: daysAgo(90) })]);

      // Act
      await usecase.execute(NOW);

      // Assert
      expect(subscriptionRepository.update).toHaveBeenCalledWith(
        "sub-1",
        expect.objectContaining({ status: "CANCELLED", cancelledAt: NOW })
      );
    });

    describe("locking a restaurant out", () => {
      it("should announce it when a subscription becomes suspended, so live staff sockets are closed", async () => {
        // Arrange
        subscriptionRepository.findAllLive.mockResolvedValue([live({ status: "RESTRICTED", pastDueSince: daysAgo(21) })]);

        // Act
        await usecase.execute(NOW);

        // Assert
        expect(eventEmitter.emit).toHaveBeenCalledWith(SUBSCRIPTION_LOCKED_EVENT, { restaurantId: "restaurant-1" });
      });

      it("should announce it when a subscription is cancelled straight from a working state", async () => {
        // Arrange — a sweep that was off for months jumps a restricted subscription all the way to cancelled
        subscriptionRepository.findAllLive.mockResolvedValue([live({ status: "RESTRICTED", pastDueSince: daysAgo(120) })]);

        // Act
        await usecase.execute(NOW);

        // Assert
        expect(eventEmitter.emit).toHaveBeenCalledWith(SUBSCRIPTION_LOCKED_EVENT, { restaurantId: "restaurant-1" });
      });

      it("should not announce suspended becoming cancelled, since staff were already locked out", async () => {
        // Arrange
        subscriptionRepository.findAllLive.mockResolvedValue([live({ status: "SUSPENDED", pastDueSince: daysAgo(90) })]);

        // Act
        await usecase.execute(NOW);

        // Assert
        expect(eventEmitter.emit).not.toHaveBeenCalled();
      });

      it("should not announce a move into a state that still lets staff work", async () => {
        // Arrange
        subscriptionRepository.findAllLive.mockResolvedValue([live({ currentPeriodEnd: daysAgo(2) })]);

        // Act
        await usecase.execute(NOW);

        // Assert — ACTIVE -> PAST_DUE
        expect(eventEmitter.emit).not.toHaveBeenCalled();
      });
    });

    it("should process every subscription it is given", async () => {
      // Arrange
      subscriptionRepository.findAllLive.mockResolvedValue([
        live({ id: "a", currentPeriodEnd: daysAgo(1) }),
        live({ id: "b" }),
        live({ id: "c", currentPeriodEnd: daysAgo(10) }),
      ]);

      // Act
      const result = await usecase.execute(NOW);

      // Assert
      expect(result.checked).toBe(3);
      expect(result.transitions.map(t => t.subscriptionId)).toEqual(["a", "c"]);
    });
  });
});
