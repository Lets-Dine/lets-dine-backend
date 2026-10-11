import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IDeliveryOverview } from "../../domain/interfaces/delivery.interface";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";

/**
 * The Delivery page: every courier with its balance already summed, and the headline numbers. No runs and
 * no settlements — a courier's page reads those itself, one statement page at a time.
 */
@Injectable()
export class GetDeliveryOverviewUsecase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(authEntity: AuthEntity): Promise<IDeliveryOverview> {
    return this.deliveryRepository.fetchOverview({ restaurantId: authEntity.restaurantId, branchId: authEntity.branchId });
  }
}
