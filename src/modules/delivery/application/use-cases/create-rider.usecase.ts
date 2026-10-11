import { Injectable } from "@nestjs/common";
import { AuditAction, DeliveryRiderPayModel } from "@prisma/client";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DELIVERY_ERROR_MESSAGES } from "../../domain/constants";
import { IDeliveryRider } from "../../domain/interfaces/delivery.interface";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";
import { CreateRiderInput } from "../../interfaces/http/validations/create-rider.validation";

/** A partner's rider is paid by the partner, and a salaried rider has no per-delivery rate. */
export function normalizePay(partnerId: string | null, payModel: DeliveryRiderPayModel, payValue: number) {
  const salaried = partnerId !== null || payModel === DeliveryRiderPayModel.SALARIED;
  return salaried ? { payModel: DeliveryRiderPayModel.SALARIED, payValue: 0 } : { payModel, payValue };
}

@Injectable()
export class CreateRiderUsecase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: CreateRiderInput, authEntity: AuthEntity): Promise<IDeliveryRider> {
    if (dto.partnerId) {
      const partner = await this.deliveryRepository.findPartner(dto.partnerId);
      if (!partner || !isInActiveBranch(authEntity, partner)) throw new NotFoundException(DELIVERY_ERROR_MESSAGES.PARTNER_NOT_FOUND);
    }
    const rider = await this.deliveryRepository.createRider(
      { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId },
      { ...dto, ...normalizePay(dto.partnerId, dto.payModel, dto.payValue) },
      authEntity.sub
    );
    await this.auditLogService.record({ action: AuditAction.courier_saved, subject: rider.name, detail: "Added a rider" }, authEntity);
    return rider;
  }
}
