import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { DELIVERY_ERROR_MESSAGES } from "../../domain/constants";
import { IDeliveryCourierDetail } from "../../domain/interfaces/delivery.interface";
import { CourierKind, DeliveryRepository } from "../../domain/repositories/delivery.repository";

/** One courier's page header: terms, balance, who is on the road. Its statement is fetched apart. */
@Injectable()
export class GetCourierDetailUsecase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(kind: CourierKind, id: string, authEntity: AuthEntity): Promise<IDeliveryCourierDetail> {
    const detail = await this.deliveryRepository.fetchCourierDetail(
      { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId },
      kind,
      id
    );
    if (!detail)
      throw new NotFoundException(kind === "PARTNER" ? DELIVERY_ERROR_MESSAGES.PARTNER_NOT_FOUND : DELIVERY_ERROR_MESSAGES.RIDER_NOT_FOUND);
    return detail;
  }
}
