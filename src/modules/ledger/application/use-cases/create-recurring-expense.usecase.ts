import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { IRecurringExpense } from "../../domain/interfaces/recurring-expense.interface";
import { RecurringExpenseRepository } from "../../domain/repositories/recurring-expense.repository";
import { localDay } from "../../domain/utils/local-day.util";
import { shapeRecurringExpense } from "../../domain/utils/shape-recurring-expense.util";
import { CreateRecurringExpenseInput } from "../../interfaces/http/validations/recurring-expense.validation";

@Injectable()
export class CreateRecurringExpenseUsecase {
  constructor(
    private readonly recurringExpenseRepository: RecurringExpenseRepository,
    private readonly restaurantRepository: RestaurantRepository
  ) {}

  async execute(dto: CreateRecurringExpenseInput, authEntity: AuthEntity): Promise<IRecurringExpense> {
    const restaurant = await this.restaurantRepository.findById(authEntity.restaurantId);
    const today = localDay(new Date(), restaurant?.timezone ?? "UTC");
    const row = await this.recurringExpenseRepository.create({
      ...dto,
      startsOn: new Date(dto.startsOn ?? today),
      restaurantId: authEntity.restaurantId,
      branchId: authEntity.branchId,
      createdBy: authEntity.sub,
    });
    return shapeRecurringExpense(row, today);
  }
}
