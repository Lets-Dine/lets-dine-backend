import { DishDietaryType } from "@prisma/client";
import { z } from "zod";

export const updateDishSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    imageUrl: z.string().url().max(500).nullish(),
    price: z.number().int().min(0).optional(),
    isAvailable: z.boolean().optional(),
    /** Null = follow the branch. */
    autoConsumeStock: z.boolean().nullish(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    spiceLevel: z.number().int().min(0).max(3).optional(),
    dietaryType: z.nativeEnum(DishDietaryType).optional(),
  })
  .refine(value => Object.keys(value).length > 0, { message: "Provide at least one change" });

export type UpdateDishInput = z.infer<typeof updateDishSchema>;
