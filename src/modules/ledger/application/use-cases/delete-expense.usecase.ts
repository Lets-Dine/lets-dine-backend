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

    // A courier settlement posted this row and the settlement owns it: removing it here would leave the delivery books disagreeing with the cash book.
    if (expense.deliverySettlementId) throw new ConflictException(LEDGER_ERROR_MESSAGES.EXPENSE_FROM_DELIVERY);

    // A supplier payment posted this row and the supplier ledger owns it: removing it would leave what is owed disagreeing with the cash book.
    if (expense.supplierPaymentId) throw new ConflictException(LEDGER_ERROR_MESSAGES.EXPENSE_FROM_SUPPLIER_PAYMENT);

    // A customer refund posted this row and the sale owns it: removing it would leave the refund recorded but its money back in the drawer.
    if (expense.paymentRefundId) throw new ConflictException(LEDGER_ERROR_MESSAGES.EXPENSE_FROM_REFUND);

    // A recurring expense posted this row and its schedule owns it: the due date is already handled, so removing it would lose the cost for good.
    if (expense.recurringExpenseId) throw new ConflictException(LEDGER_ERROR_MESSAGES.EXPENSE_FROM_RECURRING);

    // A closed period's totals are frozen; deleting from it would leave them disagreeing with the rows.
    const last = await this.ledgerRepository.findLastClose({ restaurantId: authEntity.restaurantId, branchId: authEntity.branchId });
    if (last && expense.createdAt <= last.closedAt) throw new ConflictException(LEDGER_ERROR_MESSAGES.EXPENSE_ALREADY_CLOSED);

    await this.ledgerRepository.deleteExpense(id);
  }
}
