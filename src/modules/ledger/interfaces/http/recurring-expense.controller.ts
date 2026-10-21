import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { CreateRecurringExpenseDto, SettleRecurringExpenseDto, UpdateRecurringExpenseDto } from "../../application/dto/ledger.dto";
import { CreateRecurringExpenseUsecase } from "../../application/use-cases/create-recurring-expense.usecase";
import { DeleteRecurringExpenseUsecase } from "../../application/use-cases/delete-recurring-expense.usecase";
import { ListRecurringExpensesUsecase } from "../../application/use-cases/list-recurring-expenses.usecase";
import { SettleRecurringExpenseUsecase } from "../../application/use-cases/settle-recurring-expense.usecase";
import { UpdateRecurringExpenseUsecase } from "../../application/use-cases/update-recurring-expense.usecase";
import { LEDGER_SUCCESS_MESSAGES } from "../../domain/constants";
import { IRecurringExpense } from "../../domain/interfaces/recurring-expense.interface";

const GUARDS = [AuthGuard, AbilityGuard] as const;

@Controller("restaurant/recurring-expenses")
export class RecurringExpenseController {
  constructor(
    private readonly listRecurringExpensesUsecase: ListRecurringExpensesUsecase,
    private readonly createRecurringExpenseUsecase: CreateRecurringExpenseUsecase,
    private readonly updateRecurringExpenseUsecase: UpdateRecurringExpenseUsecase,
    private readonly deleteRecurringExpenseUsecase: DeleteRecurringExpenseUsecase,
    private readonly settleRecurringExpenseUsecase: SettleRecurringExpenseUsecase
  ) {}

  @Get()
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["ledger:view"]]))
  async list(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IRecurringExpense[]>> {
    return buildHttpResponse(await this.listRecurringExpensesUsecase.execute(authEntity), LEDGER_SUCCESS_MESSAGES.RECURRING_FETCHED);
  }

  @Post()
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async create(@Body() dto: CreateRecurringExpenseDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IRecurringExpense>> {
    return buildHttpResponse(await this.createRecurringExpenseUsecase.execute(dto, authEntity), LEDGER_SUCCESS_MESSAGES.RECURRING_CREATED);
  }

  @Patch(":id")
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async update(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: UpdateRecurringExpenseDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IRecurringExpense>> {
    return buildHttpResponse(await this.updateRecurringExpenseUsecase.execute(id, dto, authEntity), LEDGER_SUCCESS_MESSAGES.RECURRING_UPDATED);
  }

  @Delete(":id")
  @HttpCode(200)
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async remove(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<null>> {
    await this.deleteRecurringExpenseUsecase.execute(id, authEntity);
    return buildHttpResponse(null, LEDGER_SUCCESS_MESSAGES.RECURRING_DELETED);
  }

  @Post(":id/settle")
  @HttpCode(200)
  @UseGuards(...GUARDS)
  @CheckPolicies(checkPermissionRules([["ledger:manage"]]))
  async settle(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: SettleRecurringExpenseDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IRecurringExpense>> {
    return buildHttpResponse(await this.settleRecurringExpenseUsecase.execute(id, dto, authEntity), LEDGER_SUCCESS_MESSAGES.RECURRING_SETTLED);
  }
}
