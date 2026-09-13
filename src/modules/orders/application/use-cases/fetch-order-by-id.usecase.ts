import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { ORDER_ERROR_MESSAGES } from "../../domain/constants";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";

@Injectable()
export class FetchOrderByIdUsecase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(id: string, authEntity: AuthEntity): Promise<IOrderWithItems> {
    const order = await this.orderRepository.findById(id);
    if (!order || order.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(ORDER_ERROR_MESSAGES.NOT_FOUND);
    }

    return order;
  }
}
