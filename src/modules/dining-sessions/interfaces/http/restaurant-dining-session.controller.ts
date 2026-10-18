import { Controller, Delete, Get, Param, ParseEnumPipe, Post, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { IDiningTable } from "../../../tables/domain/interfaces/dining-table.interface";
import { ServiceRequestUsecase, type ServiceRequestKind } from "../../application/use-cases/service-request.usecase";
import { EndDiningSessionUsecase } from "../../application/use-cases/end-dining-session.usecase";
import { StartTableSessionUsecase } from "../../application/use-cases/start-table-session.usecase";
import { DINING_SESSION_SUCCESS_MESSAGES } from "../../domain/constants";
import { type IServiceRequest } from "../../domain/interfaces/dining-session.interface";

@Controller("restaurant/tables")
export class RestaurantDiningSessionController {
  constructor(
    private readonly startTableSessionUsecase: StartTableSessionUsecase,
    private readonly endDiningSessionUsecase: EndDiningSessionUsecase
  ) {}

  /**
   * Seats a table on a diner's behalf — for a guest who can't or won't scan
   * the QR themselves. Gated on `orders:advance`, not `tables:edit`: this is
   * service, not table configuration, so STAFF (not just MANAGER+) can do it.
   */
  @Post("/:id/start-session")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async startSession(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDiningTable>> {
    const table = await this.startTableSessionUsecase.execute(id, authEntity);
    return buildHttpResponse(table, DINING_SESSION_SUCCESS_MESSAGES.DINING_SESSION_STARTED);
  }

  @Post("/:id/end-session")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["tables:edit"]]))
  async endSession(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDiningTable>> {
    const table = await this.endDiningSessionUsecase.execute(id, authEntity);
    return buildHttpResponse(table, DINING_SESSION_SUCCESS_MESSAGES.DINING_SESSION_ENDED);
  }
}

/** What the pass sees of diners asking for a waiter or the bill — any role that works the queue may act on it. */
@Controller("restaurant/service-requests")
export class RestaurantServiceRequestController {
  constructor(private readonly serviceRequestUsecase: ServiceRequestUsecase) {}

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:view"]]))
  async list(@AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IServiceRequest[]>> {
    return buildHttpResponse(await this.serviceRequestUsecase.list(authEntity), DINING_SESSION_SUCCESS_MESSAGES.SERVICE_REQUESTS_FETCHED);
  }

  @Delete("/:sessionId/:kind")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["orders:advance"]]))
  async clear(
    @Param("sessionId", ParseUuidPipe) sessionId: string,
    @Param("kind", new ParseEnumPipe({ waiter: "waiter", bill: "bill" })) kind: ServiceRequestKind,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<IServiceRequest>> {
    return buildHttpResponse(
      await this.serviceRequestUsecase.clear(sessionId, kind, authEntity),
      DINING_SESSION_SUCCESS_MESSAGES.SERVICE_REQUEST_CLEARED
    );
  }
}
