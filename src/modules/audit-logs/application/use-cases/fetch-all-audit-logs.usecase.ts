import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IAuditLog } from "../../domain/interfaces/audit-log.interface";
import { AuditLogRepository } from "../../domain/repositories/audit-log.repository";
import { FetchAuditLogsQuery } from "../../interfaces/http/validations/fetch-audit-logs.validation";

@Injectable()
export class FetchAllAuditLogsUsecase {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  async execute(query: FetchAuditLogsQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IAuditLog>> {
    const { action, actorId, from, to, ...pagination } = query;

    return this.auditLogRepository.fetchAll({ restaurantId: authEntity.restaurantId, action, actorId, from, to }, pagination);
  }
}
