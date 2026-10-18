import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse } from "../../../../common/interfaces";
import { ParseUuidPipe } from "../../../../common/pipes";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchReceivablesDto } from "../../receivables.dto";
import { IReceivables } from "../../receivables.interface";
import { ReceivableRepository } from "../../infrastructure/receivable.repository";
import { RemindReceivableUsecase } from "../../application/use-cases/remind-receivable.usecase";

@Controller("restaurant/receivables")
@UseGuards(AuthGuard, AbilityGuard)
export class ReceivableController {
  constructor(
    private readonly repository: ReceivableRepository,
    private readonly remind: RemindReceivableUsecase
  ) {}

  @Get()
  @CheckPolicies(checkPermissionRules([["payments:view"]]))
  async fetchAll(@Query() query: FetchReceivablesDto, @AuthUser() auth: AuthEntity): Promise<IHttpResponse<IReceivables>> {
    return buildHttpResponse(await this.repository.list({ ...query, restaurantId: auth.restaurantId, branchId: auth.branchId }), {
      key: "RECEIVABLES_FETCHED",
      message: "Receivables fetched",
    });
  }

  @Post(":customerId/reminders")
  @CheckPolicies(checkPermissionRules([["payments:view"]]))
  async reminded(@Param("customerId", ParseUuidPipe) customerId: string, @AuthUser() auth: AuthEntity) {
    return buildHttpResponse(await this.remind.execute(customerId, auth), { key: "RECEIVABLE_REMINDED", message: "Reminder recorded" });
  }
}
