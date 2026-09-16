import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { DishStatsService } from "../../../dishes/application/dish-stats.service";
import { DishRailKey, IDishRail } from "../../../dishes/domain/interfaces/dish-rail.interface";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { buildDishRails } from "../../../dishes/domain/utils/dish-rails.util";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { FetchMenuHighlightsQuery } from "../../interfaces/http/validations/fetch-menu-highlights.validation";

/**
 * §24 — what the menu leads with before a diner has searched for anything:
 * most loved here, trending today, hidden gems, best value. The rules behind
 * each rail live in the dishes domain, so the menu screen and this endpoint can
 * never drift apart on what "trending" means.
 */
@Injectable()
export class FetchMenuHighlightsUsecase {
  constructor(
    private readonly restaurantRepository: RestaurantRepository,
    private readonly dishRepository: DishRepository,
    private readonly dishStatsService: DishStatsService
  ) {}

  async execute(restaurantSlug: string, query: FetchMenuHighlightsQuery = {}): Promise<IDishRail[]> {
    const restaurant = await this.restaurantRepository.findBySlug(restaurantSlug);
    if (!restaurant || !restaurant.isActive) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const { rows } = await this.dishRepository.fetchAll({ restaurantId: restaurant.id, isArchived: false });
    const dishes = await this.dishStatsService.attach(rows);

    return buildDishRails(dishes, { sections: query.sections as DishRailKey[] | undefined, limit: query.limit });
  }
}
