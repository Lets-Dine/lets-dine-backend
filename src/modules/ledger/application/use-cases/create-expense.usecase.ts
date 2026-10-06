import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IExpense } from "../../domain/interfaces/ledger.interface";
import { LedgerRepository } from "../../domain/repositories/ledger.repository";
import { CreateExpenseInput } from "../../interfaces/http/validations/create-expense.validation";

@Injectable()
export class CreateExpenseUsecase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  async execute(dto: CreateExpenseInput, authEntity: AuthEntity): Promise<IExpense> {
    return this.ledgerRepository.createExpense({
      ...dto,
      restaurantId: authEntity.restaurantId,
      branchId: authEntity.branchId,
      createdBy: authEntity.sub,
      createdByName: authEntity.name,
    });
  }
}
