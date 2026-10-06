import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { CloseLedgerDto, CreateExpenseDto, FetchLedgerListDto } from "../../application/dto/ledger.dto";
import { CloseLedgerUsecase } from "../../application/use-cases/close-ledger.usecase";
import { CreateExpenseUsecase } from "../../application/use-cases/create-expense.usecase";
import { DeleteExpenseUsecase } from "../../application/use-cases/delete-expense.usecase";
import { ReopenLedgerUsecase } from "../../application/use-cases/reopen-ledger.usecase";
import { GetLedgerEntriesUsecase } from "../../application/use-cases/get-ledger-entries.usecase";
import { GetLedgerSummaryUsecase } from "../../application/use-cases/get-ledger-summary.usecase";
import { ListClosesUsecase } from "../../application/use-cases/list-closes.usecase";
import { ListExpensesUsecase } from "../../application/use-cases/list-expenses.usecase";
import { LEDGER_SUCCESS_MESSAGES } from "../../domain/constants";
import { ICashClose, IExpense, ILedgerEntry, ILedgerSummary } from "../../domain/interfaces/ledger.interface";

const VIEW = [AuthGuard, AbilityGuard] as const;

@Controller("restaurant/ledger")
export class LedgerController {
  constructor(
    private readonly getLedgerSummaryUsecase: GetLedgerSummaryUsecase,
    private readonly getLedgerEntriesUsecase: GetLedgerEntriesUsecase,
    private readonly closeLedgerUsecase: CloseLedgerUsecase,
    private readonly reopenLedgerUsecase: ReopenLedgerUsecase,
    private readonly listClosesUsecase: ListClosesUsecase,
    private readonly createExpenseUsecase: CreateExpenseUsecase,
    private readonly listExpensesUsecase: ListExpensesUsecase,
    private readonly deleteExpenseUsecase: DeleteExpenseUsecase
  ) {}

  @Get()
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["ledger:view"]]))
  async summary(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ILedgerSummary>> {
    return buildHttpResponse(await this.getLedgerSummaryUsecase.execute(authEntity), LEDGER_SUCCESS_MESSAGES.SUMMARY_FETCHED);
  }

  @Get("entries")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["ledger:view"]]))
  async entries(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ILedgerEntry[]>> {
    return buildHttpResponse(await this.getLedgerEntriesUsecase.execute(authEntity), LEDGER_SUCCESS_MESSAGES.ENTRIES_FETCHED);
  }

  @Post("close")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async close(@Body() dto: CloseLedgerDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ICashClose>> {
    return buildHttpResponse(await this.closeLedgerUsecase.execute(dto, authEntity), LEDGER_SUCCESS_MESSAGES.CLOSED);
  }

  @Post("reopen")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["ledger:reopen"]]))
  async reopen(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<ICashClose>> {
    return buildHttpResponse(await this.reopenLedgerUsecase.execute(authEntity), LEDGER_SUCCESS_MESSAGES.REOPENED);
  }

  @Get("closes")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["ledger:view"]]))
  async closes(
    @Query() query: FetchLedgerListDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<ICashClose>>> {
    return buildHttpResponse(await this.listClosesUsecase.execute(query, authEntity), LEDGER_SUCCESS_MESSAGES.CLOSES_FETCHED);
  }

  @Post("expenses")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async createExpense(@Body() dto: CreateExpenseDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IExpense>> {
    return buildHttpResponse(await this.createExpenseUsecase.execute(dto, authEntity), LEDGER_SUCCESS_MESSAGES.EXPENSE_CREATED);
  }

  @Get("expenses")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["ledger:view"]]))
  async expenses(
    @Query() query: FetchLedgerListDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<IExpense>>> {
    return buildHttpResponse(await this.listExpensesUsecase.execute(query, authEntity), LEDGER_SUCCESS_MESSAGES.EXPENSES_FETCHED);
  }

  @Delete("expenses/:id")
  @UseGuards(...VIEW)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async deleteExpense(@Param("id") id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<null>> {
    await this.deleteExpenseUsecase.execute(id, authEntity);
    return buildHttpResponse(null, LEDGER_SUCCESS_MESSAGES.EXPENSE_DELETED);
  }
}
