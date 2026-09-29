import { DishDietaryType } from "@prisma/client";
import { z } from "zod";

export const updateDishVariantSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    price: z.number().int().min(0).optional(),
    isAvailable: z.boolean().optional(),
    sortOrder: z.number().int().min(0).optional(),
    spiceLevel: z.number().int().min(0).max(3).optional(),
    dietaryType: z.nativeEnum(DishDietaryType).optional(),
  })
  .refine(value => Object.keys(value).length > 0, { message: "Provide at least one change" });

export type UpdateDishVariantInput = z.infer<typeof updateDishVariantSchema>;
