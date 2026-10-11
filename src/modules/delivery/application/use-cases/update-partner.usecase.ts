import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DELIVERY_ERROR_MESSAGES } from "../../domain/constants";
import { IDeliveryPartner } from "../../domain/interfaces/delivery.interface";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";
import { UpdatePartnerInput } from "../../interfaces/http/validations/update-partner.validation";
import { normalizeFee } from "./create-partner.usecase";

@Injectable()
export class UpdatePartnerUsecase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: UpdatePartnerInput, authEntity: AuthEntity): Promise<IDeliveryPartner> {
    const current = await this.deliveryRepository.findPartner(id);
    if (!current || !isInActiveBranch(authEntity, current)) throw new NotFoundException(DELIVERY_ERROR_MESSAGES.PARTNER_NOT_FOUND);

    const feeModel = dto.feeModel ?? current.feeModel;
    const feeValue = normalizeFee(feeModel, dto.feeValue ?? current.feeValue);
    const partner = await this.deliveryRepository.updatePartner(id, { ...dto, feeModel, feeValue }, authEntity.sub);

    const detail =
      dto.isActive !== undefined && Object.keys(dto).length === 1
        ? dto.isActive
          ? "Switched back on"
          : "Switched off"
        : "Updated the partner's terms";
    await this.auditLogService.record({ action: AuditAction.courier_saved, subject: partner.name, detail }, authEntity);
    return partner;
  }
}
