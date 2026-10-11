import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { type IDiningSession } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { DinerSession } from "../../../dining-sessions/interfaces/http/decorators/diner-session.decorator";
import { DinerSessionAnyGuard } from "../../../dining-sessions/interfaces/http/guards/diner-session-any.guard";
import { GetOrderLoyaltyUsecase } from "../../application/use-cases/get-order-loyalty.usecase";
import { LOYALTY_SUCCESS_MESSAGES } from "../../domain/constants";
import { IOrderLoyalty } from "../../domain/interfaces/loyalty.interface";

/** The diner's view of points on their own order, authorised by the table session like the rest of `orders`. */
@Controller("orders")
export class PublicLoyaltyController {
  constructor(private readonly getOrderLoyaltyUsecase: GetOrderLoyaltyUsecase) {}

  /** Also read after the visit has ended, like the order itself, so it uses the guard that allows that. */
  @Get("/:orderId/loyalty")
  @UseGuards(DinerSessionAnyGuard)
  async fetch(
    @Param("orderId", ParseUuidPipe) orderId: string,
    @DinerSession() session: IDiningSession
  ): Promise<IHttpResponse<IOrderLoyalty | null>> {
    return buildHttpResponse(await this.getOrderLoyaltyUsecase.execute(orderId, session), LOYALTY_SUCCESS_MESSAGES.ORDER_LOYALTY_FETCHED);
  }
}
