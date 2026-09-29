import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { IDiningTable } from "../../../tables/domain/interfaces/dining-table.interface";
import { EndDiningSessionUsecase } from "../../application/use-cases/end-dining-session.usecase";
import { StartTableSessionUsecase } from "../../application/use-cases/start-table-session.usecase";
import { DINING_SESSION_SUCCESS_MESSAGES } from "../../domain/constants";

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
