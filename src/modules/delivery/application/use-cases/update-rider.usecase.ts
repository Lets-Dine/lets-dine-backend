import { Injectable } from "@nestjs/common";
import { AuditAction } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DELIVERY_ERROR_MESSAGES } from "../../domain/constants";
import { IDeliveryRider } from "../../domain/interfaces/delivery.interface";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";
import { UpdateRiderInput } from "../../interfaces/http/validations/update-rider.validation";
import { normalizePay } from "./create-rider.usecase";

@Injectable()
export class UpdateRiderUsecase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(id: string, dto: UpdateRiderInput, authEntity: AuthEntity): Promise<IDeliveryRider> {
    const current = await this.deliveryRepository.findRider(id);
    if (!current || !isInActiveBranch(authEntity, current)) throw new NotFoundException(DELIVERY_ERROR_MESSAGES.RIDER_NOT_FOUND);

    const partnerId = dto.partnerId === undefined ? current.partnerId : dto.partnerId;
    if (partnerId && partnerId !== current.partnerId) {
      const partner = await this.deliveryRepository.findPartner(partnerId);
      if (!partner || !isInActiveBranch(authEntity, partner)) throw new NotFoundException(DELIVERY_ERROR_MESSAGES.PARTNER_NOT_FOUND);
    }
    const pay = normalizePay(partnerId, dto.payModel ?? current.payModel, dto.payValue ?? current.payValue);
    const rider = await this.deliveryRepository.updateRider(id, { ...dto, partnerId, ...pay }, authEntity.sub);

    const detail =
      dto.isActive !== undefined && Object.keys(dto).length === 1
        ? dto.isActive
          ? "Back on duty"
          : "Taken off duty"
        : "Updated the rider's details";
    await this.auditLogService.record({ action: AuditAction.courier_saved, subject: rider.name, detail }, authEntity);
    return rider;
  }
}
