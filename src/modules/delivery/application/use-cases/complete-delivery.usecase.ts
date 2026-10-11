import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IDeliveryAssignment } from "../../domain/interfaces/delivery.interface";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";
import { CompleteDeliveryInput } from "../../interfaces/http/validations/complete-delivery.validation";

/**
 * Closes the open run for an order with what actually came back. An order sent out with no courier
 * recorded has no run, and that is fine — there is simply nothing to close, so the answer is null.
 */
@Injectable()
export class CompleteDeliveryUsecase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(orderId: string, dto: CompleteDeliveryInput, authEntity: AuthEntity): Promise<IDeliveryAssignment | null> {
    const open = await this.deliveryRepository.findOpenAssignment(
      { restaurantId: authEntity.restaurantId, branchId: authEntity.branchId },
      orderId
    );
    if (!open) return null;
    return this.deliveryRepository.completeAssignment(open.id, dto.cashCollected, authEntity.sub);
  }
}
