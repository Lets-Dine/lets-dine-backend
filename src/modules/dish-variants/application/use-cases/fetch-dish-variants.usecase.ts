import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AuthEntity } from "../../../../common/interfaces";
import { DISH_ERROR_MESSAGES } from "../../../dishes/domain/constants";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { IDishVariant } from "../../domain/interfaces/dish-variant.interface";
import { DishVariantRepository } from "../../domain/repositories/dish-variant.repository";

/**
 * The admin editor's variants panel: every variant for one dish, live and
 * archived alike (the editor needs to see/restore archived ones too) — no
 * pagination, a dish has a handful of variants, not a browsable catalog.
 */
@Injectable()
export class FetchDishVariantsUsecase {
  constructor(
    private readonly dishVariantRepository: DishVariantRepository,
    private readonly dishRepository: DishRepository
  ) {}

  async execute(dishId: string, authEntity: AuthEntity): Promise<IDishVariant[]> {
    const dish = await this.dishRepository.findById(dishId);
    if (!dish || dish.restaurantId !== authEntity.restaurantId) {
      throw new NotFoundException(DISH_ERROR_MESSAGES.NOT_FOUND);
    }

    return this.dishVariantRepository.findByDishId(dishId);
  }
}
