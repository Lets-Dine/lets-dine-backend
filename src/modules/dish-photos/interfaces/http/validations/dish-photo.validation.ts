import { z } from "zod";

const tagsSchema = z.array(z.string().trim().toLowerCase().min(1).max(30)).max(10);

export const createDishPhotoSchema = z.object({
  /** The dish this photo shows — "Momo", "Chicken Chowmein". */
  name: z.string().trim().min(1).max(60),
  imageUrl: z.string().url().max(500),
  /** Other names the dish goes by — "dumpling", "steamed". */
  tags: tagsSchema.default([]),
});

/** Rename a dish and/or retag it — applies to every photo currently filed under `from`. */
export const updateDishPhotoGroupSchema = z.object({
  from: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(60),
  tags: tagsSchema,
});

/** Free text to match against the library; empty or missing returns the whole library. */
export const suggestDishPhotosSchema = z.object({
  name: z.string().trim().max(60).optional(),
});
