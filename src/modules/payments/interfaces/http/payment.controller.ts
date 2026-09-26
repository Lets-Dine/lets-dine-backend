import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { CompletePaymentDto } from "../../application/dto/complete-payment.dto";
import { FetchPaymentsDto } from "../../application/dto/fetch-payments.dto";
import { CompletePaymentUsecase } from "../../application/use-cases/complete-payment.usecase";
import { GetPaymentUsecase } from "../../application/use-cases/get-payment.usecase";
import { ListPaymentsUsecase } from "../../application/use-cases/list-payments.usecase";
import { PAYMENT_SUCCESS_MESSAGES } from "../../domain/constants";
import { IPaymentWithItems } from "../../domain/interfaces/payment.interface";

@Controller("restaurant/payments")
export class PaymentController {
  constructor(
    private readonly completePaymentUsecase: CompletePaymentUsecase,
    private readonly listPaymentsUsecase: ListPaymentsUsecase,
    private readonly getPaymentUsecase: GetPaymentUsecase
  ) {}

  @Post()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async complete(@Body() dto: CompletePaymentDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IPaymentWithItems>> {
    const payment = await this.completePaymentUsecase.execute(dto, authEntity);
    return buildHttpResponse(payment, PAYMENT_SUCCESS_MESSAGES.PAYMENT_COMPLETED);
  }

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["payments:view"]]))
  async fetchAll(
    @Query() query: FetchPaymentsDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<IPaymentWithItems>>> {
    const payments = await this.listPaymentsUsecase.execute(query, authEntity);
    return buildHttpResponse(payments, PAYMENT_SUCCESS_MESSAGES.PAYMENTS_FETCHED);
  }

  @Get(":id")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["payments:view"]]))
  async fetchOne(@Param("id") id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IPaymentWithItems>> {
    const payment = await this.getPaymentUsecase.execute(id, authEntity);
    return buildHttpResponse(payment, PAYMENT_SUCCESS_MESSAGES.PAYMENT_FETCHED);
  }
}
