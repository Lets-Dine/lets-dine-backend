import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { ADD_ON_ERROR_MESSAGES } from "../../domain/constants";
import { IAddOn } from "../../domain/interfaces/add-on.interface";
import { AddOnRepository } from "../../domain/repositories/add-on.repository";
import { UpdateAddOnInput } from "../../interfaces/http/validations/update-add-on.validation";

@Injectable()
export class UpdateAddOnUsecase {
  constructor(
    private readonly addOnRepository: AddOnRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: UpdateAddOnInput, authEntity: AuthEntity): Promise<IAddOn> {
    const existing = await this.addOnRepository.findById(id);
    if (!existing || existing.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(ADD_ON_ERROR_MESSAGES.NOT_FOUND);
    }

    const updated = await this.addOnRepository.update(id, dto, { actorId: authEntity.sub });

    const changedFields = Object.keys(dto);
    await this.auditLogService.record(
      { action: AuditAction.addon_updated, subject: updated.name, detail: `Changed: ${changedFields.join(", ")}` },
      authEntity
    );

    return updated;
  }
}
