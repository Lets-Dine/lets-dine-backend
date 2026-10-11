import { AuditAction, LoyaltyEntryType } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { AuditLogService } from "../../../../audit-logs/application/audit-log.service";
import { LoyaltyRepository } from "../../../domain/repositories/loyalty.repository";
import { AdjustLoyaltyUsecase } from "../adjust-loyalty.usecase";

const authUser = buildAuthEntity();
const CUSTOMER_ID = "55555555-5555-4555-8555-555555555555";
const customer = { id: CUSTOMER_ID, name: "Sita", phone: "9800000000" };

function build(over: { customer?: unknown; balance?: number } = {}) {
  const tx = {};
  const repo = {
    $transaction: jest.fn(fn => fn(tx)),
    findCustomer: jest.fn().mockResolvedValue("customer" in over ? over.customer : customer),
    lockLedger: jest.fn(),
    getBalance: jest.fn().mockResolvedValue(over.balance ?? 100),
    createEntry: jest.fn().mockImplementation(async data => ({ id: "entry-1", ...data })),
  };
  const audit = { record: jest.fn() };
  return { tx, repo, audit, usecase: new AdjustLoyaltyUsecase(repo as unknown as LoyaltyRepository, audit as unknown as AuditLogService) };
}

describe("AdjustLoyaltyUsecase", () => {
  describe("execute", () => {
    it("should append an ADJUST line, return the new balance and audit it in the same transaction", async () => {
      // Arrange
      const { tx, repo, audit, usecase } = build();

      // Act
      const result = await usecase.execute(CUSTOMER_ID, { points: 25, note: "Birthday" }, authUser);

      // Assert
      expect(result.balance).toBe(125);
      expect(repo.lockLedger).toHaveBeenCalledWith(authUser.restaurantId, CUSTOMER_ID, { tx });
      expect(repo.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({ type: LoyaltyEntryType.ADJUST, points: 25, note: "Birthday", createdBy: authUser.sub }),
        { tx }
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.loyalty_adjusted, subject: "Sita" }),
        authUser,
        tx
      );
    });

    it("should refuse to take the balance below zero", async () => {
      // Arrange
      const { repo, audit, usecase } = build({ balance: 10 });

      // Act & Assert
      await expect(usecase.execute(CUSTOMER_ID, { points: -11, note: "Oops" }, authUser)).rejects.toThrow(ConflictException);
      expect(repo.createEntry).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it("should allow spending the balance down to exactly zero", async () => {
      // Arrange
      const { usecase } = build({ balance: 10 });

      // Act
      const result = await usecase.execute(CUSTOMER_ID, { points: -10, note: "Redeemed" }, authUser);

      // Assert
      expect(result.balance).toBe(0);
    });

    it("should not touch a customer who is not one of this restaurant's regulars", async () => {
      // Arrange
      const { repo, usecase } = build({ customer: null });

      // Act & Assert
      await expect(usecase.execute(CUSTOMER_ID, { points: 5, note: "x" }, authUser)).rejects.toThrow(NotFoundException);
      expect(repo.$transaction).not.toHaveBeenCalled();
    });
  });
});
