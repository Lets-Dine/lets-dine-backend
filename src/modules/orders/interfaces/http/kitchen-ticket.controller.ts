import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { AdvanceKitchenTicketDto } from "../../application/dto/advance-kitchen-ticket.dto";
import { FetchKitchenTicketsDto } from "../../application/dto/fetch-kitchen-tickets.dto";
import { AdvanceKitchenTicketUsecase } from "../../application/use-cases/advance-kitchen-ticket.usecase";
import { DismissKitchenTicketWarningUsecase } from "../../application/use-cases/dismiss-kitchen-ticket-warning.usecase";
import { AcknowledgeKitchenTicketUsecase } from "../../application/use-cases/acknowledge-kitchen-ticket.usecase";
import { FetchUnacknowledgedTicketsUsecase } from "../../application/use-cases/fetch-unacknowledged-tickets.usecase";
import { FetchKitchenTicketsUsecase } from "../../application/use-cases/fetch-kitchen-tickets.usecase";
import { ORDER_SUCCESS_MESSAGES } from "../../domain/constants";
import { IKitchenTicket } from "../../domain/interfaces/kitchen-ticket.interface";

@Controller("restaurant/kitchen-tickets")
export class KitchenTicketController {
  constructor(
    private readonly fetchKitchenTicketsUsecase: FetchKitchenTicketsUsecase,
    private readonly acknowledgeKitchenTicketUsecase: AcknowledgeKitchenTicketUsecase,
    private readonly fetchUnacknowledgedTicketsUsecase: FetchUnacknowledgedTicketsUsecase,
    private readonly advanceKitchenTicketUsecase: AdvanceKitchenTicketUsecase,
    private readonly dismissKitchenTicketWarningUsecase: DismissKitchenTicketWarningUsecase
  ) {}

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:view"]]))
  async fetchAll(@Query() query: FetchKitchenTicketsDto, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IKitchenTicket[]>> {
    const tickets = await this.fetchKitchenTicketsUsecase.execute(query.station, authEntity);
    return buildHttpResponse(tickets, ORDER_SUCCESS_MESSAGES.KITCHEN_TICKETS_FETCHED);
  }

  /** What the front of house should warn about: tickets a station with a device has not acknowledged. */
  @Get("/unacknowledged")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:view"]]))
  async fetchUnacknowledged(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IKitchenTicket[]>> {
    const tickets = await this.fetchUnacknowledgedTicketsUsecase.execute(authEntity);
    return buildHttpResponse(tickets, ORDER_SUCCESS_MESSAGES.KITCHEN_TICKETS_FETCHED);
  }

  @Post("/:id/acknowledge")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async acknowledge(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IKitchenTicket>> {
    const ticket = await this.acknowledgeKitchenTicketUsecase.execute(id, authEntity);
    return buildHttpResponse(ticket, ORDER_SUCCESS_MESSAGES.KITCHEN_TICKET_ACKNOWLEDGED);
  }

  /** "Start" or "Ready" from the kitchen's own screen — moves every line the ticket asked for. */
  @Post("/:id/advance")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async advance(
    @Param("id", ParseUuidPipe) id: string,
    @Body() dto: AdvanceKitchenTicketDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IKitchenTicket>> {
    const ticket = await this.advanceKitchenTicketUsecase.execute(id, dto, authEntity);
    return buildHttpResponse(ticket, ORDER_SUCCESS_MESSAGES.KITCHEN_TICKET_ADVANCED);
  }

  /** The front of house stops being warned about one ticket. */
  @Post("/:id/dismiss-warning")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async dismissWarning(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<null>> {
    await this.dismissKitchenTicketWarningUsecase.execute(id, authEntity);
    return buildHttpResponse(null, ORDER_SUCCESS_MESSAGES.KITCHEN_TICKET_WARNING_DISMISSED);
  }
}
