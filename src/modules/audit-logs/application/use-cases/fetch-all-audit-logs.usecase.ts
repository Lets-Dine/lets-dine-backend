import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { EntitlementService } from "../../../billing/application/entitlement.service";
import { clampToRetention } from "../../../billing/domain/utils/audit-retention.util";
import { IAuditLog } from "../../domain/interfaces/audit-log.interface";
import { AuditLogRepository } from "../../domain/repositories/audit-log.repository";
import { FetchAuditLogsQuery } from "../../interfaces/http/validations/fetch-audit-logs.validation";

@Injectable()
export class FetchAllAuditLogsUsecase {
  constructor(
    private readonly auditLogRepository: AuditLogRepository,
    private readonly entitlementService: EntitlementService
  ) {}

  async execute(query: FetchAuditLogsQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IAuditLog>> {
    const { action, actorId, from: requestedFrom, to, ...pagination } = query;

    // History older than the plan's retention window is not served, whatever range was asked for.
    const { features } = await this.entitlementService.getEntitlements(authEntity.restaurantId);
    const from = clampToRetention(requestedFrom, features.auditRetentionDays, new Date());

    return this.auditLogRepository.fetchAll(
      { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId, action, actorId, from, to },
      pagination
    );
  }
}
