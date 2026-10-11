import { NotFoundException } from "../../../../../common/exceptions";
import { IDiningSession } from "../../../../dining-sessions/domain/interfaces/dining-session.interface";
import { LoyaltyRepository } from "../../../domain/repositories/loyalty.repository";
import { GetOrderLoyaltyUsecase } from "../get-order-loyalty.usecase";

const session = { id: "session-1", customerId: null } as unknown as IDiningSession;
const program = { enabled: true, spendPerPoint: 1000, redeemValue: 50, maxRedeemPct: 50, reviewBonus: 20 };
const tableOrder = {
  id: "order-1",
  restaurantId: "r-1",
  sessionId: "session-1",
  customerId: "customer-1",
  floorId: null,
  orderType: "DINE_IN",
  subtotal: 25000,
  discount: 0,
  paidAt: null,
};

function build(over: { order?: unknown; program?: unknown; given?: boolean } = {}) {
  const repo = {
    findOrder: jest.fn().mockResolvedValue("order" in over ? over.order : tableOrder),
    findProgram: jest.fn().mockResolvedValue("program" in over ? over.program : program),
    hasOrderEntry: jest.fn().mockResolvedValue(over.given ?? false),
    sumEarnedForOrder: jest.fn().mockResolvedValue(30),
    sumEarnedForSession: jest.fn().mockResolvedValue(45),
    sumVisitEarnableBase: jest.fn().mockResolvedValue(34000),
    hasSessionPayment: jest.fn().mockResolvedValue(false),
  };
  return { repo, usecase: new GetOrderLoyaltyUsecase(repo as unknown as LoyaltyRepository) };
}

describe("GetOrderLoyaltyUsecase", () => {
  describe("execute", () => {
    it("should report a table order's points by visit and the review bonus on offer, and nothing identifying", async () => {
      // Arrange
      const { repo, usecase } = build();

      // Act
      const result = await usecase.execute("order-1", session);

      // Assert
      expect(result).toEqual({ earned: 45, reviewBonus: 20, reviewBonusGiven: false, expected: 0 });
      expect(repo.sumEarnedForSession).toHaveBeenCalledWith("session-1", "customer-1");
    });

    it("should report a floor or delivery order's points by that order alone", async () => {
      // Arrange
      const { repo, usecase } = build({ order: { ...tableOrder, floorId: "floor-1" } });

      // Act
      const result = await usecase.execute("order-1", session);

      // Assert
      expect(result?.earned).toBe(30);
      expect(repo.sumEarnedForOrder).toHaveBeenCalledWith("order-1");
      expect(repo.sumEarnedForSession).not.toHaveBeenCalled();
    });

    it("should estimate what an unpaid table bill will earn from the whole visit's orders", async () => {
      // Arrange: nothing earned yet; the visit's live orders come to 34000, at 1000 a point.
      const { repo, usecase } = build();
      repo.sumEarnedForSession.mockResolvedValue(0);

      // Act
      const result = await usecase.execute("order-1", session);

      // Assert
      expect(result?.expected).toBe(34);
      expect(repo.sumVisitEarnableBase).toHaveBeenCalledWith("session-1");
    });

    it("should estimate a floor or delivery order from that order alone, after its discount", async () => {
      // Arrange
      const { repo, usecase } = build({ order: { ...tableOrder, floorId: "floor-1", subtotal: 25000, discount: 5000 } });
      repo.sumEarnedForOrder.mockResolvedValue(0);

      // Act
      const result = await usecase.execute("order-1", session);

      // Assert
      expect(result?.expected).toBe(20);
      expect(repo.sumVisitEarnableBase).not.toHaveBeenCalled();
    });

    it("should stop estimating once the bill is paid, even if it earned nothing", async () => {
      // Arrange
      const table = build();
      table.repo.sumEarnedForSession.mockResolvedValue(0);
      table.repo.hasSessionPayment.mockResolvedValue(true);
      const floor = build({ order: { ...tableOrder, floorId: "floor-1", paidAt: new Date() } });
      floor.repo.sumEarnedForOrder.mockResolvedValue(0);

      // Act & Assert
      expect((await table.usecase.execute("order-1", session))?.expected).toBe(0);
      expect((await floor.usecase.execute("order-1", session))?.expected).toBe(0);
    });

    it("should follow the payment's customer: a floor order's own, never the session's", async () => {
      // Arrange: the payment for a floor order is charged to that order's customer only.
      const { usecase } = build({ order: { ...tableOrder, floorId: "floor-1", customerId: null } });

      // Act & Assert
      expect(await usecase.execute("order-1", { ...session, customerId: "customer-7" } as IDiningSession)).toBeNull();
    });

    it("should follow the payment's customer: a table's is the visit's, ahead of the order's", async () => {
      // Arrange
      const { repo, usecase } = build();

      // Act
      await usecase.execute("order-1", { ...session, customerId: "customer-7" } as IDiningSession);

      // Assert
      expect(repo.sumEarnedForSession).toHaveBeenCalledWith("session-1", "customer-7");
    });

    it("should stop offering the bonus once it has been given", async () => {
      // Arrange
      const { usecase } = build({ given: true });

      // Act & Assert
      expect(await usecase.execute("order-1", session)).toEqual({ earned: 45, reviewBonus: 0, reviewBonusGiven: true, expected: 0 });
    });

    it("should say nothing when the program is off or the order has no customer", async () => {
      // Arrange & Act & Assert
      expect(await build({ program: { ...program, enabled: false } }).usecase.execute("order-1", session)).toBeNull();
      expect(await build({ program: null }).usecase.execute("order-1", session)).toBeNull();
      expect(await build({ order: { ...tableOrder, customerId: null } }).usecase.execute("order-1", session)).toBeNull(); // and no session customer either
    });

    it("should use the session's customer when the order has none, as the bill was charged", async () => {
      // Arrange
      const { repo, usecase } = build({ order: { ...tableOrder, customerId: null } });

      // Act
      const result = await usecase.execute("order-1", { ...session, customerId: "customer-7" } as IDiningSession);

      // Assert
      expect(result?.earned).toBe(45);
      expect(repo.sumEarnedForSession).toHaveBeenCalledWith("session-1", "customer-7");
    });

    it("should refuse an order that is not this session's, or does not exist", async () => {
      // Arrange & Act & Assert
      await expect(build({ order: { ...tableOrder, sessionId: "someone-else" } }).usecase.execute("order-1", session)).rejects.toThrow(
        NotFoundException
      );
      await expect(build({ order: null }).usecase.execute("order-1", session)).rejects.toThrow(NotFoundException);
    });
  });
});
