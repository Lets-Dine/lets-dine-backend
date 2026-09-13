import { Injectable } from "@nestjs/common";
import { PaginatedResponse } from "../../../../common/interfaces";
import { IDiningSession } from "../../../dining-sessions/domain/interfaces/dining-session.interface";
import { IOrderWithItems } from "../../domain/interfaces/order.interface";
import { OrderRepository } from "../../domain/repositories/order.repository";
import { FetchOrdersQuery } from "../../interfaces/http/validations/fetch-orders.validation";

/** Everything this table has ordered during this visit. */
@Injectable()
export class FetchSessionOrdersUsecase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(query: FetchOrdersQuery, session: IDiningSession): Promise<PaginatedResponse<IOrderWithItems>> {
    const { status, tableId: _tableId, from, to, ...pagination } = query;

    return this.orderRepository.fetchAll({ sessionId: session.id, statuses: status, from, to }, pagination);
  }
}
