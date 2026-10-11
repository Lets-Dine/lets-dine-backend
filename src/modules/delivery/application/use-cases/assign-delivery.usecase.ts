import { Injectable } from "@nestjs/common";
import { AuditAction, DeliveryAccountKind, OrderStatus, OrderType } from "@prisma/client";
import { BadRequestException, ConflictException, NotFoundException } from "../../../../common/exceptions";
import { AuthEntity, isInActiveBranch } from "../../../../common/interfaces";
import { AuditLogService } from "../../../audit-logs/application/audit-log.service";
import { DELIVERY_ERROR_MESSAGES } from "../../domain/constants";
import { IDeliveryAssignment } from "../../domain/interfaces/delivery.interface";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";
import { AssignDeliveryInput } from "../../interfaces/http/validations/assign-delivery.validation";

/**
 * Hands a delivery order to a rider or a partner and snapshots what they will be paid and what they
 * should bring back. A run still open for the order is replaced, so reassigning is one step. A partner's
 * rider settles through the partner, so the run is filed under the partner's account.
 */
@Injectable()
export class AssignDeliveryUsecase {
  constructor(
    private readonly deliveryRepository: DeliveryRepository,
    private readonly auditLogService: AuditLogService
  ) {}

  async execute(orderId: string, dto: AssignDeliveryInput, authEntity: AuthEntity): Promise<IDeliveryAssignment> {
    const scope = { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId };
    if (!dto.riderId && !dto.partnerId) throw new BadRequestException(DELIVERY_ERROR_MESSAGES.COURIER_REQUIRED);

    const order = await this.deliveryRepository.findOrder(orderId);
    if (!order || !isInActiveBranch(authEntity, order)) throw new NotFoundException(DELIVERY_ERROR_MESSAGES.ORDER_NOT_FOUND);
    if (order.orderType !== OrderType.DELIVERY) throw new BadRequestException(DELIVERY_ERROR_MESSAGES.NOT_A_DELIVERY_ORDER);
    if (order.status === OrderStatus.COMPLETED || order.status === OrderStatus.CANCELLED)
      throw new ConflictException(DELIVERY_ERROR_MESSAGES.ORDER_CLOSED);

    const rider = dto.riderId ? await this.deliveryRepository.findRider(dto.riderId) : null;
    if (dto.riderId && (!rider || !isInActiveBranch(authEntity, rider)))
      throw new NotFoundException(DELIVERY_ERROR_MESSAGES.RIDER_NOT_FOUND);
    if (rider && !rider.isActive) throw new ConflictException(DELIVERY_ERROR_MESSAGES.COURIER_INACTIVE);

    const partnerId = dto.partnerId ?? rider?.partnerId ?? null;
    if (dto.partnerId && rider?.partnerId && rider.partnerId !== dto.partnerId)
      throw new BadRequestException(DELIVERY_ERROR_MESSAGES.RIDER_PARTNER_MISMATCH);
    const partner = partnerId ? await this.deliveryRepository.findPartner(partnerId) : null;
    if (partnerId && (!partner || !isInActiveBranch(authEntity, partner)))
      throw new NotFoundException(DELIVERY_ERROR_MESSAGES.PARTNER_NOT_FOUND);
    if (partner && dto.partnerId && !partner.isActive) throw new ConflictException(DELIVERY_ERROR_MESSAGES.COURIER_INACTIVE);

    if (dto.cashToCollect > order.total) throw new BadRequestException(DELIVERY_ERROR_MESSAGES.CASH_EXCEEDS_TOTAL);
    if (partner && !partner.collectsCash && dto.cashToCollect > 0)
      throw new BadRequestException(DELIVERY_ERROR_MESSAGES.PARTNER_DOES_NOT_COLLECT);

    const account = partner
      ? { kind: DeliveryAccountKind.PARTNER, id: partner.id }
      : { kind: DeliveryAccountKind.RIDER, id: (rider as { id: string }).id };

    const assignment = await this.deliveryRepository.$transaction(async tx => {
      await this.deliveryRepository.deleteOpenAssignments(scope, order.id, { tx });
      const created = await this.deliveryRepository.createAssignment(
        {
          ...scope,
          orderId: order.id,
          orderRef: order.reference,
          customerName: order.deliveryCustomerName || "Guest",
          orderTotal: order.total,
          riderId: rider?.id ?? null,
          partnerId: partner?.id ?? null,
          riderName: rider?.name ?? null,
          partnerName: partner?.name ?? null,
          accountKind: account.kind,
          accountId: account.id,
          courierFee: dto.courierFee,
          cashToCollect: dto.cashToCollect,
          createdBy: authEntity.sub,
        },
        { tx }
      );
      await this.auditLogService.record(
        {
          action: AuditAction.delivery_dispatched,
          subject: `Order ${order.reference}`,
          detail: `Handed to ${rider?.name ?? partner?.name}${rider && partner ? ` (${partner.name})` : ""}, fee ${dto.courierFee}, cash to collect ${dto.cashToCollect}`,
        },
        authEntity,
        tx
      );
      return created;
    });
    return assignment;
  }
}
