import { Injectable } from "@nestjs/common";
import { AuthEntity, PaginatedResponse } from "../../../../common/interfaces";
import { IDishWithStats } from "../../domain/interfaces/dish-with-stats.interface";
import { DishRepository } from "../../domain/repositories/dish.repository";
import { FetchDishesQuery } from "../../interfaces/http/validations/fetch-dishes.validation";
import { DishStatsService } from "../dish-stats.service";

/** The dashboard's menu board: every dish, archived ones included on request. */
@Injectable()
export class FetchAllDishesUsecase {
  constructor(
    private readonly dishRepository: DishRepository,
    private readonly dishStatsService: DishStatsService
  ) {}

  async execute(query: FetchDishesQuery, authEntity: AuthEntity): Promise<PaginatedResponse<IDishWithStats>> {
    const { keyword, categoryId, isAvailable, isArchived, isFeatured, ...pagination } = query;

    const { rows, count } = await this.dishRepository.fetchAll(
      { restaurantId: authEntity.restaurantId, keyword, categoryId, isAvailable, isArchived, isFeatured },
      pagination
    );

    return { rows: await this.dishStatsService.attach(rows), count };
  }
}
