import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchTransactionsDto } from "../../application/dto/transaction.dto";
import { GetTransactionSummaryUsecase } from "../../application/use-cases/get-transaction-summary.usecase";
import { ListTransactionsUsecase } from "../../application/use-cases/list-transactions.usecase";
import { ITransaction, ITransactionSummary } from "../../domain/interfaces/transaction.interface";

@Controller("restaurant/transactions")
export class TransactionController {
  constructor(
    private readonly listTransactionsUsecase: ListTransactionsUsecase,
    private readonly getTransactionSummaryUsecase: GetTransactionSummaryUsecase
  ) {}

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["ledger:view"]]))
  async list(
    @Query() query: FetchTransactionsDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<ITransaction>>> {
    return buildHttpResponse(await this.listTransactionsUsecase.execute(query, authEntity), {
      key: "TRANSACTIONS_FETCHED",
      message: "Transactions fetched",
    });
  }

  @Get("summary")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["ledger:view"]]))
  async summary(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ITransactionSummary>> {
    return buildHttpResponse(await this.getTransactionSummaryUsecase.execute(authEntity), {
      key: "TRANSACTION_SUMMARY_FETCHED",
      message: "Receivables and payables fetched",
    });
  }
}
