import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { IAddOn } from "../../domain/interfaces/add-on.interface";
import { AddOnRepository } from "../../domain/repositories/add-on.repository";
import { CreateAddOnInput } from "../../interfaces/http/validations/create-add-on.validation";

@Injectable()
export class CreateAddOnUsecase {
  constructor(
    private readonly addOnRepository: AddOnRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: CreateAddOnInput, authEntity: AuthEntity): Promise<IAddOn> {
    const addOn = await this.addOnRepository.create(
      { ...dto, restaurantId: authEntity.restaurantId, branchId: authEntity.branchId },
      { actorId: authEntity.sub }
    );

    await this.auditLogService.record({ action: AuditAction.addon_created, subject: addOn.name }, authEntity);

    return addOn;
  }
}
