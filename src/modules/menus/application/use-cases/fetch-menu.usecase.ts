import { Injectable } from "@nestjs/common";
import { NotFoundException } from "../../../../common/exceptions";
import { AddOnRepository } from "../../../add-ons/domain/repositories/add-on.repository";
import { DishVariantRepository } from "../../../dish-variants/domain/repositories/dish-variant.repository";
import { DishRepository } from "../../../dishes/domain/repositories/dish.repository";
import { MenuCategoryRepository } from "../../../menu-categories/domain/repositories/menu-category.repository";
import { RESTAURANT_ERROR_MESSAGES } from "../../../restaurants/domain/constants";
import { RestaurantRepository } from "../../../restaurants/domain/repositories/restaurant.repository";
import { IMenu } from "../../domain/interfaces/menu.interface";
import { RestaurantRatingRepository } from "../../domain/repositories/restaurant-rating.repository";

/**
 * §13/§24 — the whole diner-facing menu in one call: the restaurant, its
 * sections, every live dish with the numbers that make it worth ordering,
 * and the add-on catalog those dishes link into. Archived dishes are gone;
 * unavailable ones stay, because "sold out" is information a diner wants.
 */
@Injectable()
export class FetchMenuUsecase {
  constructor(
    private readonly restaurantRepository: RestaurantRepository,
    private readonly restaurantRatingRepository: RestaurantRatingRepository,
    private readonly menuCategoryRepository: MenuCategoryRepository,
    private readonly dishRepository: DishRepository,
    private readonly addOnRepository: AddOnRepository,
    private readonly dishVariantRepository: DishVariantRepository
  ) {}

  async execute(restaurantSlug: string): Promise<IMenu> {
    const restaurant = await this.restaurantRepository.findBySlug(restaurantSlug);
    if (!restaurant || !restaurant.isActive) throw new NotFoundException(RESTAURANT_ERROR_MESSAGES.NOT_FOUND);

    const [rating, categories, dishes, addOns] = await Promise.all([
      this.restaurantRatingRepository.fetchRating(restaurant.id),
      this.menuCategoryRepository.fetchAll({ restaurantId: restaurant.id }),
      this.dishRepository.findAllWithStats({ restaurantId: restaurant.id, isArchived: false }),
      this.addOnRepository.fetchAll({ restaurantId: restaurant.id, isArchived: false }),
    ]);

    const dishIds = dishes.map(dish => dish.id);
    const addOnIdsByDish = await this.addOnRepository.findLinkedIdsByDishIds(dishIds);
    const variantsByDish = await this.dishVariantRepository.findManyByDishIds(dishIds, { isArchived: false });

    return {
      restaurant: { ...restaurant, ...rating },
      categories: categories.rows,
      dishes: dishes.map(dish => ({ ...dish, addOnIds: addOnIdsByDish[dish.id] ?? [], variants: variantsByDish[dish.id] ?? [] })),
      addOns: addOns.rows,
    };
  }
}
