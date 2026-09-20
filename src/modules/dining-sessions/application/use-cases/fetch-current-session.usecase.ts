import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { DINING_TABLE_ERROR_MESSAGES } from "../../../tables/domain/constants";
import { DiningTableRepository } from "../../../tables/domain/repositories/dining-table.repository";
import { IDiningSession } from "../../domain/interfaces/dining-session.interface";
import { IResolvedSession } from "../../domain/interfaces/resolved-session.interface";

/** Re-opening the tab mid-meal: the session token alone rebuilds the context. */
@Injectable()
export class FetchCurrentSessionUsecase {
  constructor(
    private readonly restaurantRepository: RestaurantRepository,
    private readonly diningTableRepository: DiningTableRepository
  ) {}

  async execute(session: IDiningSession): Promise<IResolvedSession> {
    const table = await this.diningTableRepository.findById(session.tableId);
    if (!table) throw new NotFoundException(DINING_TABLE_ERROR_MESSAGES.NOT_FOUND);

    return { session, table };
  }
}
