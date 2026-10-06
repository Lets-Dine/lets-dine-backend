import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IExpense } from "../../domain/interfaces/ledger.interface";
import { LedgerRepository } from "../../domain/repositories/ledger.repository";
import { FetchLedgerListQuery } from "../../interfaces/http/validations/fetch-ledger-list.validation";

/** Expenses of the open period — closed periods are read through their close's totals. */
@Injectable()
export class ListExpensesUsecase {
  constructor(private readonly ledgerRepository: LedgerRepository) {}

  async execute(query: FetchLedgerListQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IExpense>> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };
    const last = await this.ledgerRepository.findLastClose(scope);
    return this.ledgerRepository.fetchExpenses(scope, last?.closedAt ?? null, query);
  }
}
