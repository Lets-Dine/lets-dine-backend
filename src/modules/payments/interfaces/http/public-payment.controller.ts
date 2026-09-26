import { Controller, Get, Headers } from "@nestjs/common";
import { UnauthorizedException } from "../../../../common/exceptions";
import { IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { DINING_SESSION_ERROR_MESSAGES } from "../../../dining-sessions/domain/constants";
import { SESSION_TOKEN_HEADER } from "../../../dining-sessions/interfaces/http/guards/diner-session.guard";
import { FetchSessionPaymentUsecase } from "../../application/use-cases/fetch-session-payment.usecase";
import { PAYMENT_SUCCESS_MESSAGES } from "../../domain/constants";
import { IPaymentWithItems } from "../../domain/interfaces/payment.interface";

@Controller("public/sessions")
export class PublicPaymentController {
  constructor(private readonly fetchSessionPaymentUsecase: FetchSessionPaymentUsecase) {}

  /**
   * Not `DinerSessionGuard` — that rejects an ended session, and settling a
   * table ends it in the same motion. See `FetchSessionPaymentUsecase`.
   */
  @Get("payment")
  async fetchForSession(@Headers(SESSION_TOKEN_HEADER) token?: string): Promise<IHttpResponse<IPaymentWithItems | null>> {
    if (!token) throw new UnauthorizedException(DINING_SESSION_ERROR_MESSAGES.REQUIRED);
    const payment = await this.fetchSessionPaymentUsecase.execute(token);
    return buildHttpResponse(payment, PAYMENT_SUCCESS_MESSAGES.PAYMENT_FETCHED);
  }
}
