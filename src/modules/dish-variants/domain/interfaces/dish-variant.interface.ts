import { DishDietaryType } from "@prisma/client";

export interface IDishVariant {
  id: string;
  dishId: string;
  name: string;
  /** Own absolute price, integer minor units (paisa) — never a delta off Dish.price. */
  price: number;
  isAvailable: boolean;
  isArchived: boolean;
  sortOrder: number;
  spiceLevel: number;
  dietaryType: DishDietaryType;
  createdAt: Date;
  updatedAt: Date;
}
