import { z } from "zod";

export const createDishPhotoSchema = z.object({
  /** The dish this photo shows — "Momo", "Chicken Chowmein". */
  name: z.string().trim().min(1).max(60),
  imageUrl: z.string().url().max(500),
});

/** Free text to match against the library; empty or missing returns the whole library. */
export const suggestDishPhotosSchema = z.object({
  name: z.string().trim().max(60).optional(),
});
