import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AddOnRepository } from "../../../add-ons/domain/repositories/add-on.repository";
import { DishVariantRepository } from "../../../dish-variants/domain/repositories/dish-variant.repository";
import { DISH_ERROR_MESSAGES } from "../../domain/constants";
import { IDishWithStats } from "../../domain/interfaces/dish-with-stats.interface";
import { DishRepository } from "../../domain/repositories/dish.repository";

/**
 * §8 — the dish detail screen, public. An archived dish is gone as far as a
 * diner is concerned, even though its order history still points at it.
 */
@Injectable()
export class FetchDishByIdUsecase {
  constructor(
    private readonly dishRepository: DishRepository,
    private readonly addOnRepository: AddOnRepository,
    private readonly dishVariantRepository: DishVariantRepository
  ) {}

  async execute(id: string, options?: { includeArchived?: boolean }): Promise<IDishWithStats> {
    const [dish] = await this.dishRepository.findAllWithStats({ ids: [id] });
    if (!dish || (dish.isArchived && !options?.includeArchived)) {
      throw new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND);
    }

    const addOnIdsByDish = await this.addOnRepository.findLinkedIdsByDishIds([id]);
    // No isArchived filter — the admin editor needs to see/restore archived variants too.
    const variants = await this.dishVariantRepository.findByDishId(id);

    return { ...dish, addOnIds: addOnIdsByDish[id] ?? [], variants };
  }
}
