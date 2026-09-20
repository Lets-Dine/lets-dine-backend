import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { CompletePaymentDto } from "../../application/dto/complete-payment.dto";
import { CompletePaymentUsecase } from "../../application/use-cases/complete-payment.usecase";
import { PAYMENT_SUCCESS_MESSAGES } from "../../domain/constants";
import { IPaymentWithItems } from "../../domain/interfaces/payment.interface";

@Controller("restaurant/payments")
export class PaymentController {
  constructor(private readonly completePaymentUsecase: CompletePaymentUsecase) {}

  @Post()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async complete(@Body() dto: CompletePaymentDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IPaymentWithItems>> {
    const payment = await this.completePaymentUsecase.execute(dto, authEntity);
    return buildHttpResponse(payment, PAYMENT_SUCCESS_MESSAGES.PAYMENT_COMPLETED);
  }
}
