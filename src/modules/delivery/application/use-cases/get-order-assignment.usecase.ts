import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IDeliveryAssignment } from "../../domain/interfaces/delivery.interface";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";

/** The open run for an order, else its latest — or null when it was sent out with no courier recorded. */
@Injectable()
export class GetOrderAssignmentUsecase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(orderId: string, authEntity: AuthEntity): Promise<IDeliveryAssignment | null> {
    return this.deliveryRepository.findAssignmentForOrder(
      { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId },
      orderId
    );
  }
}
