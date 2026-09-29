import { IAddOn } from "../../../add-ons/domain/interfaces/add-on.interface";
import { IDishWithStats } from "../../../dishes/domain/interfaces/dish-with-stats.interface";
import { IMenuCategory } from "../../../menu-categories/domain/interfaces/menu-category.interface";
import { IRestaurant } from "../../../restaurants/domain/interfaces/restaurant.interface";

export interface IRestaurantRating {
  avgRating: number | null;
  ratingCount: number;
}

export type IMenuRestaurant = IRestaurant & IRestaurantRating;

/** §13 — one request behind the QR scan: the place, its sections, its dishes, its add-ons. */
export interface IMenu {
  restaurant: IMenuRestaurant;
  categories: IMenuCategory[];
  dishes: IDishWithStats[];
  addOns: IAddOn[];
}
