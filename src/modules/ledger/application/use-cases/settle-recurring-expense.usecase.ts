import { Injectable } from "@nestjs/common";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { LEDGER_ERROR_MESSAGES } from "../../domain/constants";
import { IRecurringExpense } from "../../domain/interfaces/recurring-expense.interface";
import { RecurringExpenseRepository } from "../../domain/repositories/recurring-expense.repository";
import { localDay } from "../../domain/utils/local-day.util";
import { shapeRecurringExpense } from "../../domain/utils/shape-recurring-expense.util";
import { ExpenseKind } from "@prisma/client";
import { LedgerRepository } from "../../domain/repositories/ledger.repository";
import { dueDates } from "../../domain/utils/recurrence.util";
import { recurrenceOf } from "../../domain/utils/shape-recurring-expense.util";
import { SettleRecurringExpenseInput } from "../../interfaces/http/validations/recurring-expense.validation";

/**
 * Handles the oldest waiting due date: posts it to the cash book as an expense, or skips it. Either way the cursor
 * moves past it in the same transaction, and only if nobody moved it first — so a double tap posts once.
 * The expense lands when it is posted (now), not on the due date, so a closed period is never reopened by it.
 */
@Injectable()
export class SettleRecurringExpenseUsecase {
  constructor(
    private readonly recurringExpenseRepository: RecurringExpenseRepository,
    private readonly ledgerRepository: LedgerRepository,
    private readonly restaurantRepository: RestaurantRepository
  ) {}

  async execute(id: string, dto: SettleRecurringExpenseInput, authEntity: AuthEntity): Promise<IRecurringExpense> {
    const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId);
    const today = localDay(new Date(), restaurant?.timezone ?? "UTC");

    return this.recurringExpenseRepository.$transaction(async tx => {
      const row = await this.recurringExpenseRepository.findById(id, { tx });
      if (!row || !isInActiveBranch(authEntity, row)) throw new NotFoundException(LEDGER_ERROR_MESSAGES.RECURRING_NOT_FOUND);

      const waiting = row.isActive ? dueDates(recurrenceOf(row), today) : [];
      if (waiting[0] !== dto.dueOn) throw new ConflictException(LEDGER_ERROR_MESSAGES.RECURRING_NOT_DUE);

      // Skipping everything moves the cursor to today, past every date waiting.
      const through = dto.action === "skip-all" ? today : dto.dueOn;
      const moved = await this.recurringExpenseRepository.advance(id, row.handledThrough, new Date(through), tx);
      if (!moved) throw new ConflictException(LEDGER_ERROR_MESSAGES.RECURRING_NOT_DUE);

      if (dto.action === "post") {
        await this.ledgerRepository.createExpense(
          {
            restaurantId: row.restaurantId,
            branchId: row.branchId,
            kind: ExpenseKind.EXPENSE,
            amount: row.amount,
            method: row.method,
            category: row.category,
            note: ["Recurring", `due ${dto.dueOn}`, row.note].filter(Boolean).join(" · ").slice(0, 300),
            recurringExpenseId: row.id,
            recurringDueOn: new Date(dto.dueOn),
            createdBy: authEntity.sub,
            createdByName: authEntity.name,
          },
          { tx }
        );
      }

      const after = await this.recurringExpenseRepository.findById(id, { tx });
      return shapeRecurringExpense(after!, today);
    });
  }
}
