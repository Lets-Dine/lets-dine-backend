import { ConflictException, NotFoundException } from "../../../../../common/exceptions";
import { buildAuthEntity } from "../../../../../common/testing";
import { LEDGER_ERROR_MESSAGES } from "../../../domain/constants";
import { LedgerRepository } from "../../../domain/repositories/ledger.repository";
import { DeleteExpenseUsecase } from "../delete-expense.usecase";

const authUser = buildAuthEntity();
const scope = { restaurantId: authUser.restaurantId, branchId: authUser.branchId };
const expense = { id: "exp-1", ...scope, createdAt: new Date("2026-10-10T10:00:00Z"), deliverySettlementId: null };

function build(over: { expense?: unknown; lastClose?: unknown } = {}) {
  const repo = {
    findExpense: jest.fn().mockResolvedValue("expense" in over ? over.expense : expense),
    findLastClose: jest.fn().mockResolvedValue("lastClose" in over ? over.lastClose : null),
    deleteExpense: jest.fn(),
  };
  return { repo, usecase: new DeleteExpenseUsecase(repo as unknown as LedgerRepository) };
}

describe("DeleteExpenseUsecase", () => {
  describe("execute", () => {
    it("should delete an ordinary expense in the open period", async () => {
      // Arrange
      const { repo, usecase } = build();

      // Act
      await usecase.execute("exp-1", authUser);

      // Assert
      expect(repo.deleteExpense).toHaveBeenCalledWith("exp-1");
    });

    it("should refuse to delete a row a delivery settlement posted", async () => {
      // Arrange
      const { repo, usecase } = build({ expense: { ...expense, deliverySettlementId: "st-1" } });

      // Act / Assert
      await expect(usecase.execute("exp-1", authUser)).rejects.toMatchObject({
        message: LEDGER_ERROR_MESSAGES.EXPENSE_FROM_DELIVERY.message,
      });
      expect(repo.deleteExpense).not.toHaveBeenCalled();
    });

    it("should refuse to delete from a closed period", async () => {
      const { usecase } = build({ lastClose: { closedAt: new Date("2026-10-10T20:00:00Z") } });

      await expect(usecase.execute("exp-1", authUser)).rejects.toBeInstanceOf(ConflictException);
    });

    it("should treat another branch's expense as missing", async () => {
      const { usecase } = build({ expense: { ...expense, branchId: "other-branch" } });

      await expect(usecase.execute("exp-1", authUser)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
