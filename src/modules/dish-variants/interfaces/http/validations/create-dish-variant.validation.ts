import { DishDietaryType } from "@prisma/client";
import { z } from "zod";

export const createDishVariantSchema = z.object({
  name: z.string().min(1).max(120),
  /** Own absolute price, integer minor units — never a delta off Dish.price. */
  price: z.number().int().min(0),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  spiceLevel: z.number().int().min(0).max(3).optional(),
  dietaryType: z.nativeEnum(DishDietaryType).optional(),
});

export type CreateDishVariantInput = z.infer<typeof createDishVariantSchema>;
