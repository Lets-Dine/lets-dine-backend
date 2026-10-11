import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IDeliveryBook } from "../../domain/interfaces/delivery.interface";
import { DeliveryRepository } from "../../domain/repositories/delivery.repository";

/** What the ticket's dispatch sheet needs: active riders, the partners, and who is out. No settlements, so staff never see the books. */
@Injectable()
export class GetDispatchCouriersUsecase {
  constructor(private readonly deliveryRepository: DeliveryRepository) {}

  async execute(authEntity: AuthEntity): Promise<IDeliveryBook> {
    return this.deliveryRepository.fetchDispatchBook({ restaurantId: authEntity.restaurantId, branchId: authEntity.branchId });
  }
}
