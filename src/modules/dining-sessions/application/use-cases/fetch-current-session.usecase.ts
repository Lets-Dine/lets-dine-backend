import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { CustomerRepository } from "../../../customers/domain/repositories/customer.repository";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { DINING_TABLE_ERROR_MESSAGES } from "../../../tables/domain/constants";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { IDiningSession } from "../../domain/interfaces/dining-session.interface";
import { IResolvedSession } from "../../domain/interfaces/resolved-session.interface";

/** Re-opening the tab mid-meal (or mid-delivery-order): the session token alone rebuilds the context. */
@Injectable()
export class FetchCurrentSessionUsecase {
  constructor(
    private readonly restaurantRepository: RestaurantRepository,
    private readonly diningTableRepository: DiningTableRepository,
    private readonly customerRepository: CustomerRepository
  ) {}

  async execute(session: IDiningSession): Promise<IResolvedSession> {
    const restaurant = await this.restaurantRepository.findById(session.restaurantId);
    if (!restaurant) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    if (!session.tableId) {
      const customer = session.customerId ? await this.customerRepository.findById(session.customerId) : null;
      return { session, restaurant, table: null, customer };
    }

    const table = await this.diningTableRepository.findById(session.tableId);
    if (!table) throw new NotFoundException(DINING_TABLE_ERROR_MESSAGES.NOT_FOUND);

    return { session, restaurant, table };
  }
}
