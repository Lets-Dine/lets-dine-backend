import { Injectable } from "@nestjs/common";
import { AuditAction, DeliveryFeeModel } from "@prisma/client";
import { BadRequestException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DELIVERY_ERROR_MESSAGES } from "../../domain/constants";
import { IDeliveryPartner } from "../../domain/interfaces/delivery.interface";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";
import { CreatePartnerInput } from "../../interfaces/http/validations/create-partner.validation";

/** A percentage is stored as basis points, so 100% is 10,000; a model with no fee carries no value. */
export function normalizeFee(feeModel: DeliveryFeeModel, feeValue: number): number {
  if (feeModel === DeliveryFeeModel.NONE) return 0;
  if (feeModel === DeliveryFeeModel.PERCENT && feeValue > 10_000) throw new BadRequestException(DELIVERY_ERROR_MESSAGES.INVALID_PERCENT);
  return feeValue;
}

@Injectable()
export class CreatePartnerUsecase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(dto: CreatePartnerInput, authEntity: AuthEntity): Promise<IDeliveryPartner> {
    const partner = await this.deliveryRepository.createPartner(
      { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId },
      { ...dto, feeValue: normalizeFee(dto.feeModel, dto.feeValue) },
      authEntity.sub
    );
    await this.auditLogService.record(
      { action: AuditAction.courier_saved, subject: partner.name, detail: "Added a delivery partner" },
      authEntity
    );
    return partner;
  }
}
