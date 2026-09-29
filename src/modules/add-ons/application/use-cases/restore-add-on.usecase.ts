import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { ADD_ON_ERROR_MESSAGES } from "../../domain/constants";
import { IAddOn } from "../../domain/interfaces/add-on.interface";
import { AddOnRepository } from "../../domain/repositories/add-on.repository";

@Injectable()
export class RestoreAddOnUsecase {
  constructor(
    private readonly addOnRepository: AddOnRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IAddOn> {
    const existing = await this.addOnRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(ADD_ON_ERROR_MESSAGES.NOT_FOUND);
    }
    if (!existing.isArchived) throw new ConflictException(ADD_ON_ERROR_MESSAGES.NOT_ARCHIVED);

    const restored = await this.addOnRepository.update(id, { isArchived: false }, { actorId: authEntity.sub });

    await this.auditLogService.record(
      { action: AuditAction.addon_restored, subject: existing.name, detail: "Restored, still unavailable" },
      authEntity
    );

    return restored;
  }
}
