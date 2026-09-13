import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { DISH_ERROR_MESSAGES } from "../../domain/constants";
import { IDishWithStats } from "../../domain/interfaces/dish-with-stats.interface";
import { DishRepository } from "../../domain/repositories/dish.repository";
import { DishStatsService } from "../dish-stats.service";

/**
 * §8 — the dish detail screen, public. An archived dish is gone as far as a
 * diner is concerned, even though its order history still points at it.
 */
@Injectable()
export class FetchDishByIdUsecase {
  constructor(
    private readonly dishRepository: DishRepository,
    private readonly dishStatsService: DishStatsService
  ) {}

  async execute(id: string, options?: { includeArchived?: boolean }): Promise<IDishWithStats> {
    const dish = await this.dishRepository.findById(id);
    if (!dish || (dish.isArchived && !options?.includeArchived)) {
      throw new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND);
    }

    return this.dishStatsService.attachOne(dish);
  }
}
