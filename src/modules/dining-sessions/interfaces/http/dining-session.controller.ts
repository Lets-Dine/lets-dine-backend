import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { IHttpResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { StartDeliverySessionDto } from "../../application/dto/start-delivery-session.dto";
import { StartDiningSessionDto } from "../../application/dto/start-dining-session.dto";
import { FetchCurrentSessionUsecase } from "../../application/use-cases/fetch-current-session.usecase";
import { StartDeliverySessionUsecase } from "../../application/use-cases/start-delivery-session.usecase";
import { StartDiningSessionUsecase } from "../../application/use-cases/start-dining-session.usecase";
import { DINING_SESSION_SUCCESS_MESSAGES } from "../../domain/constants";
import { type IDiningSession } from "../../domain/interfaces/dining-session.interface";
import { IResolvedSession } from "../../domain/interfaces/resolved-session.interface";
import { DinerSession } from "./decorators/diner-session.decorator";
import { DinerSessionGuard } from "./guards/diner-session.guard";

@Controller("public/sessions")
export class DiningSessionController {
  constructor(
    private readonly startDiningSessionUsecase: StartDiningSessionUsecase,
    private readonly startDeliverySessionUsecase: StartDeliverySessionUsecase,
    private readonly fetchCurrentSessionUsecase: FetchCurrentSessionUsecase
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async start(@Body() dto: StartDiningSessionDto): Promise<IHttpResponse<IResolvedSession>> {
    const resolved = await this.startDiningSessionUsecase.execute(dto);
    return buildHttpResponse(resolved, DINING_SESSION_SUCCESS_MESSAGES.DINING_SESSION_STARTED);
  }

  /** No QR, no table — a phone number opens the visit instead. */
  @Post("/delivery")
  @HttpCode(HttpStatus.CREATED)
  async startDelivery(@Body() dto: StartDeliverySessionDto): Promise<IHttpResponse<IResolvedSession>> {
    const resolved = await this.startDeliverySessionUsecase.execute(dto);
    return buildHttpResponse(resolved, DINING_SESSION_SUCCESS_MESSAGES.DINING_SESSION_STARTED);
  }

  @Get("/current")
  @UseGuards(DinerSessionGuard)
  async fetchCurrent(@DinerSession() session: IDiningSession): Promise<IHttpResponse<IResolvedSession>> {
    const resolved = await this.fetchCurrentSessionUsecase.execute(session);
    return buildHttpResponse(resolved, DINING_SESSION_SUCCESS_MESSAGES.DINING_SESSION_FETCHED);
  }
}
