import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DINING_TABLE_ERROR_MESSAGES } from "../../domain/constants";
import { IDiningTable } from "../../domain/interfaces/dining-table.interface";
import { DiningTableRepository } from "../../domain/repositories/dining-table.repository";
import { UpdateTableInput } from "../../interfaces/http/validations/update-table.validation";

@Injectable()
export class UpdateTableUsecase {
  constructor(
    private readonly diningTableRepository: DiningTableRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: UpdateTableInput, authEntity: AuthEntity): Promise<IDiningTable> {
    const existing = await this.diningTableRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(DINING_TABLE_ERROR_MESSAGES.NOT_FOUND);
    }

    if (dto.name && dto.name !== existing.name) {
      const clash = await this.diningTableRepository.findByName(authEntity.restaurantId, dto.name);
      if (clash) throw new ConflictException(DINING_TABLE_ERROR_MESSAGES.NAME_ALREADY_EXISTS);
    }

    const updated = await this.diningTableRepository.update(id, dto, { actorId: authEntity.sub });

    if (dto.name && dto.name !== existing.name) {
      await this.auditLogService.record(
        { action: AuditAction.table_renamed, subject: dto.name, detail: `${existing.name} → ${dto.name}` },
        authEntity
      );
    }

    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      await this.auditLogService.record(
        {
          action: dto.isActive ? AuditAction.table_enabled : AuditAction.table_disabled,
          subject: updated.name,
          detail: dto.isActive ? "Back in service" : "Out of service — its QR stops resolving",
        },
        authEntity
      );
    }

    return updated;
  }
}
