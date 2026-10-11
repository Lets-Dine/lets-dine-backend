import { LoyaltyEntryType } from "@prisma/client";
import { BadRequestException, ConflictException } from "../../../../../common/exceptions";
import { LoyaltyRepository } from "../../../domain/repositories/loyalty.repository";
import { LoyaltyService } from "../../loyalty.service";

const RESTAURANT_ID = "33333333-3333-4333-8333-333333333333";
const CUSTOMER_ID = "55555555-5555-4555-8555-555555555555";
const payment = { id: "pay-1", restaurantId: RESTAURANT_ID, customerId: CUSTOMER_ID, subtotal: 45000, discount: 0 };

const tx = {} as never;
function build(
  program: unknown = { enabled: true, spendPerPoint: 1000, redeemValue: 50, maxRedeemPct: 50, reviewBonus: 20 },
  balance = 500
) {
  const repo = {
    findProgram: jest.fn().mockResolvedValue(program),
    createEntry: jest.fn().mockResolvedValue({}),
    lockLedger: jest.fn(),
    $transaction: jest.fn(fn => fn(tx)),
    hasOrderEntry: jest.fn().mockResolvedValue(false),
    getBalance: jest.fn().mockResolvedValue(balance),
  };
  return { repo, service: new LoyaltyService(repo as unknown as LoyaltyRepository) };
}

describe("LoyaltyService", () => {
  describe("earnForPayment", () => {
    it("should earn nothing when the restaurant has no program", async () => {
      // Arrange
      const { repo, service } = build(null);

      // Act
      const points = await service.earnForPayment(payment);

      // Assert
      expect(points).toBe(0);
      expect(repo.createEntry).not.toHaveBeenCalled();
    });

    it("should earn nothing when the program is off", async () => {
      // Arrange
      const { repo, service } = build({ enabled: false, spendPerPoint: 1000 });

      // Act
      const points = await service.earnForPayment(payment);

      // Assert
      expect(points).toBe(0);
      expect(repo.createEntry).not.toHaveBeenCalled();
    });

    it("should earn nothing when the bill has no customer", async () => {
      // Arrange
      const { repo, service } = build();

      // Act
      const points = await service.earnForPayment({ ...payment, customerId: null });

      // Assert
      expect(points).toBe(0);
      expect(repo.findProgram).not.toHaveBeenCalled();
      expect(repo.createEntry).not.toHaveBeenCalled();
    });

    it("should round down to whole points", async () => {
      // Arrange
      const { repo, service } = build();

      // Act
      const points = await service.earnForPayment({ ...payment, subtotal: 45999 });

      // Assert
      expect(points).toBe(45);
      expect(repo.createEntry).toHaveBeenCalledWith(
        { restaurantId: RESTAURANT_ID, customerId: CUSTOMER_ID, type: LoyaltyEntryType.EARN, points: 45, paymentId: "pay-1" },
        { tx: undefined }
      );
    });

    it("should earn on the subtotal after the discount, not before it", async () => {
      // Arrange
      const { service } = build();

      // Act
      const points = await service.earnForPayment({ ...payment, subtotal: 45000, discount: 10000 });

      // Assert
      expect(points).toBe(35);
    });

    it("should not let points spent on the bill reduce what it earns", async () => {
      // Arrange: Rs 100 at 1000 a point is worth 100 points before and after 2 points' discount.
      const { repo, service } = build();

      // Act
      const points = await service.earnForPayment({ ...payment, subtotal: 10000, discount: 100, loyaltyDiscount: 100 });

      // Assert
      expect(points).toBe(10);
      expect(repo.createEntry).toHaveBeenCalledWith(expect.objectContaining({ points: 10 }), { tx: undefined });
    });

    it("should never let a points discount larger than the discount push the base above the subtotal", async () => {
      // Arrange & Act: a (never expected) loyaltyDiscount bigger than the whole discount.
      const { service } = build();
      const points = await service.earnForPayment({ ...payment, subtotal: 10000, discount: 100, loyaltyDiscount: 900 });

      // Assert: capped at the subtotal's own 10 points.
      expect(points).toBe(10);
    });

    it("should earn in full on a bill paid entirely in points", async () => {
      // Arrange & Act
      const { service } = build();
      const points = await service.earnForPayment({ ...payment, subtotal: 10000, discount: 10000, loyaltyDiscount: 10000 });

      // Assert
      expect(points).toBe(10);
    });

    it("should still take the cashier's own discount off, alongside points", async () => {
      // Arrange
      const { service } = build();

      // Act: 10000 less a 2000 manual discount (the 500 of points is not counted) leaves 8000.
      const points = await service.earnForPayment({ ...payment, subtotal: 10000, discount: 2500, loyaltyDiscount: 500 });

      // Assert
      expect(points).toBe(8);
    });

    it("should earn nothing when the bill is too small for one point", async () => {
      // Arrange
      const { repo, service } = build();

      // Act
      const points = await service.earnForPayment({ ...payment, subtotal: 900 });

      // Assert
      expect(points).toBe(0);
      expect(repo.createEntry).not.toHaveBeenCalled();
    });

    it("should record which order a single-order bill was for", async () => {
      // Arrange
      const { repo, service } = build();

      // Act
      await service.earnForPayment({ ...payment, orderId: "order-1" });

      // Assert
      expect(repo.createEntry).toHaveBeenCalledWith(expect.objectContaining({ paymentId: "pay-1", orderId: "order-1" }), { tx: undefined });
    });

    it("should key the line on the payment and pass the caller's transaction through", async () => {
      // Arrange
      const { repo, service } = build();
      const tx = {} as never;

      // Act
      await service.earnForPayment(payment, tx);
      await service.earnForPayment(payment, tx);

      // Assert: the repository upserts on (paymentId, type), so a retried settlement is a no-op there.
      expect(repo.createEntry).toHaveBeenCalledTimes(2);
      for (const [entry, options] of repo.createEntry.mock.calls) {
        expect(entry).toMatchObject({ paymentId: "pay-1", type: LoyaltyEntryType.EARN });
        expect(options).toEqual({ tx });
      }
    });
  });

  describe("planRedemption", () => {
    const input = { restaurantId: RESTAURANT_ID, customerId: CUSTOMER_ID, points: 100, discountableBase: 40000 };

    it("should turn points into money at the restaurant's rate, under the ledger lock", async () => {
      // Arrange
      const { repo, service } = build();

      // Act
      const discount = await service.planRedemption(input, tx);

      // Assert
      expect(discount).toBe(5000);
      expect(repo.lockLedger).toHaveBeenCalledWith(RESTAURANT_ID, CUSTOMER_ID, { tx });
      expect(repo.getBalance).toHaveBeenCalledWith(RESTAURANT_ID, CUSTOMER_ID, { tx });
    });

    it("should refuse when the bill has no customer", async () => {
      // Arrange
      const { service } = build();

      // Act & Assert
      await expect(service.planRedemption({ ...input, customerId: null }, tx)).rejects.toThrow(BadRequestException);
    });

    it("should refuse when the program is off or missing", async () => {
      // Arrange & Act & Assert
      await expect(
        build({ enabled: false, spendPerPoint: 1000, redeemValue: 50, maxRedeemPct: 50, reviewBonus: 20 }).service.planRedemption(input, tx)
      ).rejects.toThrow(BadRequestException);
      await expect(build(null).service.planRedemption(input, tx)).rejects.toThrow(BadRequestException);
    });

    it("should refuse more points than the customer has", async () => {
      // Arrange
      const { service } = build(undefined, 50);

      // Act & Assert
      await expect(service.planRedemption(input, tx)).rejects.toThrow(ConflictException);
    });

    it("should refuse points worth more than the cap and say the most that fits", async () => {
      // Arrange: 50% of 40000 = 20000 cap, at 50 per point = 400 points; balance is plenty.
      const { service } = build(undefined, 5000);

      // Act & Assert
      await expect(service.planRedemption({ ...input, points: 401 }, tx)).rejects.toMatchObject({
        exception: { detail: { maxPoints: 400 } },
      });
      await expect(service.planRedemption({ ...input, points: 400 }, tx)).resolves.toBe(20000);
    });
  });

  describe("grantReviewBonus", () => {
    const order = { id: "order-1", restaurantId: RESTAURANT_ID, customerId: CUSTOMER_ID };

    it("should grant the bonus once, tied to the order, under the ledger lock", async () => {
      // Arrange
      const { repo, service } = build();

      // Act
      const points = await service.grantReviewBonus(order);

      // Assert
      expect(points).toBe(20);
      expect(repo.lockLedger).toHaveBeenCalledWith(RESTAURANT_ID, CUSTOMER_ID, { tx });
      expect(repo.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: LoyaltyEntryType.REVIEW_BONUS, points: 20, orderId: "order-1", customerId: CUSTOMER_ID }),
        { tx }
      );
    });

    it("should not grant a second bonus for the same order", async () => {
      // Arrange
      const { repo, service } = build();
      repo.hasOrderEntry.mockResolvedValue(true);

      // Act
      const points = await service.grantReviewBonus(order);

      // Assert
      expect(points).toBe(0);
      expect(repo.createEntry).not.toHaveBeenCalled();
    });

    it("should grant nothing without a customer, with the program off, or with a zero bonus", async () => {
      // Arrange & Act
      const noCustomer = build();
      const off = build({ enabled: false, spendPerPoint: 1000, redeemValue: 50, maxRedeemPct: 50, reviewBonus: 20 });
      const noBonus = build({ enabled: true, spendPerPoint: 1000, redeemValue: 50, maxRedeemPct: 50, reviewBonus: 0 });
      const none = build(null);

      // Assert
      expect(await noCustomer.service.grantReviewBonus({ ...order, customerId: null })).toBe(0);
      expect(await off.service.grantReviewBonus(order)).toBe(0);
      expect(await noBonus.service.grantReviewBonus(order)).toBe(0);
      expect(await none.service.grantReviewBonus(order)).toBe(0);
      for (const { repo } of [noCustomer, off, noBonus, none]) expect(repo.createEntry).not.toHaveBeenCalled();
    });
  });
});
