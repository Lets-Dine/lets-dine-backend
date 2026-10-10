import { DishDietaryType } from "@prisma/client";

export interface IDish {
  id: string;
  restaurantId: string;
  /** The branch whose menu this dish is on. */
  branchId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  /** Integer minor units (paisa) — §34, never a float. */
  price: number;
  isAvailable: boolean;
  /** Null = inherit from the branch, then the restaurant. */
  autoConsumeStock: boolean | null;
  isArchived: boolean;
  isFeatured: boolean;
  sortOrder: number;
  spiceLevel: number;
  dietaryType: DishDietaryType;
  createdAt: Date;
  updatedAt: Date;
}
