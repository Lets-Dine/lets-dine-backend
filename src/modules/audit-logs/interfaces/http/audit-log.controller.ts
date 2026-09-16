import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AbilityGuard, AuthGuard, AuthUser, CheckPolicies, checkPermissionRules } from "../../../../common/auth";
import { type AuthEntity, IHttpResponse, PaginatedResponse } from "../../../../common/interfaces";
import { buildHttpResponse } from "../../../../common/utils";
import { FetchAuditLogsDto } from "../../application/dto/fetch-audit-logs.dto";
import { FetchAllAuditLogsUsecase } from "../../application/use-cases/fetch-all-audit-logs.usecase";
import { AUDIT_LOG_SUCCESS_MESSAGES } from "../../domain/constants";
import { IAuditLog } from "../../domain/interfaces/audit-log.interface";

@Controller("restaurant/audit-logs")
export class AuditLogController {
  constructor(private readonly fetchAllAuditLogsUsecase: FetchAllAuditLogsUsecase) {}

  @Get()
  @UseGuards(AuthGuard, AbilityGuard)
  @CheckPolicies(checkPermissionRules([["audit:view"]]))
  async fetchAll(
    @Query() query: FetchAuditLogsDto,
    @AuthUser() authEntity: AuthEntity
  ): Promise<IHttpResponse<PaginatedResponse<IAuditLog>>> {
    const auditLogs = await this.fetchAllAuditLogsUsecase.execute(query, authEntity);
    return buildHttpResponse(auditLogs, AUDIT_LOG_SUCCESS_MESSAGES.AUDIT_LOGS_FETCHED);
  }
}
