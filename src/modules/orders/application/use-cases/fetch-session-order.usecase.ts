import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { IDiningSession } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { Order } from "../../domain/entity/order.entity";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";

/**
 * §38 — the diner's status screen polls this. Another table's session must not
 * be able to read it, so ownership is checked rather than assumed from the id.
 */
@Injectable()
export class FetchSessionOrderUsecase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(id: string, session: IDiningSession): Promise<IOrderWithItems> {
    const order = await this.orderRepository.findById(id);
    if (!order || !new Order(order).belongsToSession(session.id)) {
      throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);
    }

    return order;
  }
}
