import { Injectable } from "@nestjs/common";
import { BadRequestException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { LEDGER_ERROR_MESSAGES } from "../../domain/constants";
import { IRecurringExpense } from "../../domain/interfaces/recurring-expense.interface";
import { RecurringExpenseRepository } from "../../domain/repositories/recurring-expense.repository";
import { localDay } from "../../domain/utils/local-day.util";
import { addDays } from "../../domain/utils/recurrence.util";
import { shapeRecurringExpense } from "../../domain/utils/shape-recurring-expense.util";
import { UpdateRecurringExpenseInput } from "../../interfaces/http/validations/recurring-expense.validation";

/**
 * Changes apply from now on. A new schedule (or a resume from a pause) starts counting from today, so the dates it
 * would have had in the past are never revived and a period already posted is not charged again. What was already
 * posted or skipped stays as it was.
 */
@Injectable()
export class UpdateRecurringExpenseUsecase {
  constructor(
    private readonly recurringExpenseRepository: RecurringExpenseRepository,
    private readonly restaurantRepository: RestaurantRepository
  ) {}

  async execute(id: string, dto: UpdateRecurringExpenseInput, authEntity: AuthEntity): Promise<IRecurringExpense> {
    const found = await this.recurringExpenseRepository.findById(id);
    if (!found || !isInActiveBranch(authEntity, found)) throw new NotFoundException(LEDGER_ERROR_MESSAGES.RECURRING_NOT_FOUND);

    // The day only means something with its frequency, so check the pair as it will be stored.
    const frequency = dto.frequency ?? found.frequency;
    const dueDay = dto.dueDay ?? found.dueDay;
    if (frequency === "WEEKLY" ? dueDay > 6 : dueDay < 1) throw new BadRequestException(LEDGER_ERROR_MESSAGES.RECURRING_BAD_DAY);

    const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId);
    const today = localDay(new Date(), restaurant?.timezone ?? "UTC");

    const rescheduled = frequency !== found.frequency || dueDay !== found.dueDay;
    const resumed = dto.isActive === true && !found.isActive;
    const row = await this.recurringExpenseRepository.update(id, {
      ...dto,
      ...((rescheduled || resumed) && { handledThrough: new Date(addDays(today, -1)) }),
    });
    return shapeRecurringExpense(row, today);
  }
}
