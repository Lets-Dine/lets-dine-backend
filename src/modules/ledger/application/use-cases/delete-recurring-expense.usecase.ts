import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { LEDGER_ERROR_MESSAGES } from "../../domain/constants";
import { RecurringExpenseRepository } from "../../domain/repositories/recurring-expense.repository";

/** Only the schedule goes: expenses it already posted are ordinary cash-book rows and stay. */
@Injectable()
export class DeleteRecurringExpenseUsecase {
  constructor(private readonly recurringExpenseRepository: RecurringExpenseRepository) {}

  async execute(id: string, authEntity: AuthEntity): Promise<void> {
    const found = await this.recurringExpenseRepository.findById(id);
    if (!found || !isInActiveBranch(authEntity, found)) throw new NotFoundException(LEDGER_ERROR_MESSAGES.RECURRING_NOT_FOUND);
    await this.recurringExpenseRepository.delete(id);
  }
}
