import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { ADD_ON_ERROR_MESSAGES } from "../../domain/constants";
import { IAddOn } from "../../domain/interfaces/add-on.interface";
import { AddOnRepository } from "../../domain/repositories/add-on.repository";

/** An add-on with order history is archived, never deleted — mirrors ArchiveDishUsecase (§28). */
@Injectable()
export class ArchiveAddOnUsecase {
  constructor(
    private readonly addOnRepository: AddOnRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IAddOn> {
    const existing = await this.addOnRepository.findById(id);
    if (!existing || !isInActiveBranch(authEntity, existing)) {
      throw new NotFoundException(ADD_ON_ERROR_MESSAGES.NOT_FOUND);
    }
    if (existing.isArchived) throw new ConflictException(ADD_ON_ERROR_MESSAGES.ALREADY_ARCHIVED);

    const archived = await this.addOnRepository.update(id, { isArchived: true, isAvailable: false }, { actorId: authEntity.sub });

    await this.auditLogService.record({ action: AuditAction.addon_archived, subject: existing.name }, authEntity);

    return archived;
  }
}
