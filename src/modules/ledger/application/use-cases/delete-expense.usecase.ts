import { Injectable } from "@nestjs/common";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { LEDGER_ERROR_MESSAGES } from "../../domain/constants";
import { LedgerRepository } from "../../domain/repositories/ledger.repository";

@Injectable()
export class DeleteExpenseUsecase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  async execute(id: string, authEntity: AuthEntity): Promise<void> {
    const expense = await this.ledgerRepository.findExpense(id);
    if (!expense || !isInActiveBranch(authEntity, expense)) throw new NotFoundException(LEDGER_ERROR_MESSAGES.EXPENSE_NOT_FOUND);

    // A closed period's totals are frozen; deleting from it would leave them disagreeing with the rows.
    const last = await this.ledgerRepository.findLastClose({ restaurantId: authEntity.restaurantId, branchId: authEntity.branchId });
    if (last && expense.createdAt <= last.closedAt) throw new ConflictException(LEDGER_ERROR_MESSAGES.EXPENSE_ALREADY_CLOSED);

    await this.ledgerRepository.deleteExpense(id);
  }
}
