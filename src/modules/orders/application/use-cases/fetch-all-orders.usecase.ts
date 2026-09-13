import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { FetchOrdersQuery } from "../../interfaces/http/validations/fetch-orders.validation";

/** §27 — the pass: every ticket for this restaurant, filterable by stage. */
@Injectable()
export class FetchAllOrdersUsecase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(query: FetchOrdersQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IOrderWithItems>> {
    const { status, tableId, from, to, ...pagination } = query;

    return this.orderRepository.fetchAll({ restaurantId: authEntity.restaurantId, statuses: status, tableId, from, to }, pagination);
  }
}
