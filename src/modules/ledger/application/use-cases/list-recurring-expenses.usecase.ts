import { Injectable } from "@nestjs/common";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { IRecurringExpense } from "../../domain/interfaces/recurring-expense.interface";
import { RecurringExpenseRepository } from "../../domain/repositories/recurring-expense.repository";
import { localDay } from "../../domain/utils/local-day.util";
import { shapeRecurringExpense } from "../../domain/utils/shape-recurring-expense.util";

@Injectable()
export class ListRecurringExpensesUsecase {
  constructor(
    private readonly recurringExpenseRepository: RecurringExpenseRepository,
    private readonly restaurantRepository: RestaurantRepository
  ) {}

  async execute(authEntity: AuthEntity): Promise<IRecurringExpense[]> {
    const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId);
    const today = localDay(new Date(), restaurant?.timezone ?? "UTC");
    const rows = await this.recurringExpenseRepository.findForBranch(authEntity.restaurantId, authEntity.branchId);
    return rows.map(row => shapeRecurringExpense(row, today));
  }
}
