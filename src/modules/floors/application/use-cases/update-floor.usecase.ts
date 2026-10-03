import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { FLOOR_ERROR_MESSAGES } from "../../domain/constants";
import { IFloor } from "../../domain/interfaces/floor.interface";
import { FloorRepository } from "../../domain/repositories/floor.repository";
import { UpdateFloorInput } from "../../interfaces/http/validations/update-floor.validation";

@Injectable()
export class UpdateFloorUsecase {
  constructor(
    private readonly floorRepository: FloorRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: UpdateFloorInput, authEntity: AuthEntity): Promise<IFloor> {
    const existing = await this.floorRepository.findById(id);
    if (!existing || !isInActiveBranch(authEntity, existing)) {
      throw new NotFoundException(FLOOR_ERROR_MESSAGES.NOT_FOUND);
    }

    if (dto.name && dto.name !== existing.name) {
      const clash = await this.floorRepository.findByName(authEntity.branchId, dto.name);
      if (clash) throw new ConflictException(FLOOR_ERROR_MESSAGES.NAME_ALREADY_EXISTS);
    }

    const updated = await this.floorRepository.update(id, dto, { actorId: authEntity.sub });

    if (dto.name && dto.name !== existing.name) {
      await this.auditLogService.record(
        { action: AuditAction.floor_renamed, subject: dto.name, detail: `${existing.name} → ${dto.name}` },
        authEntity
      );
    }

    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      await this.auditLogService.record(
        {
          action: dto.isActive ? AuditAction.floor_enabled : AuditAction.floor_disabled,
          subject: updated.name,
          detail: dto.isActive ? "Back in service" : "Out of service — its QR stops resolving",
        },
        authEntity
      );
    }

    return updated;
  }
}
