-- AlterTable
ALTER TABLE "dish_variants" ADD COLUMN     "dietary_type" "DishDietaryType" NOT NULL DEFAULT 'NON_VEG',
ADD COLUMN     "spice_level" INTEGER NOT NULL DEFAULT 0;
