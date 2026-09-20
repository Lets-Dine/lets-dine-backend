import { Injectable } from "@nestjs/common";
import { AuthEntity } from "../../../../common/interfaces";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";

/** The staff-facing counterpart of `FetchSessionOrdersUsecase` — a manager looks up a visit by its session id rather than by their own token. */
@Injectable()
export class FetchOrdersBySessionUsecase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(sessionId: string, authEntity: AuthEntity): Promise<IOrderWithItems[]> {
    return this.orderRepository.findBySessionId(sessionId, authEntity.restaurantId);
  }
}
