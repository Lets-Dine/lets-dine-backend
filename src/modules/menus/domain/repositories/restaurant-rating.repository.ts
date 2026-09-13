import { PrismaTransaction } from "../../../../common/prisma";
import { IRestaurantRating } from "../interfaces/menu.interface";

export abstract class RestaurantRatingRepository {
  /** Every visible dish review at this restaurant, rolled into one number. */
  abstract fetchRating(restaurantId: string, options?: { tx?: PrismaTransaction }): Promise<IRestaurantRating>;
}
