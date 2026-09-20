import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { IDiningTable } from "../../../tables/domain/interfaces/dining-table.interface";
import { EndDiningSessionUsecase } from "../../application/use-cases/end-dining-session.usecase";
import { DINING_SESSION_SUCCESS_MESSAGES } from "../../domain/constants";

@Controller("restaurant/tables")
export class RestaurantDiningSessionController {
  constructor(private readonly endDiningSessionUsecase: EndDiningSessionUsecase) {}

  @Post("/:id/end-session")
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["tables:edit"]]))
  async endSession(@Param("id", ParseUuidPipe) id: string, @AuthUser() authEntity: AuthEntity): Promise<IHttpResponse<IDiningTable>> {
    const table = await this.endDiningSessionUsecase.execute(id, authEntity);
    return buildHttpResponse(table, DINING_SESSION_SUCCESS_MESSAGES.DINING_SESSION_ENDED);
  }
}
