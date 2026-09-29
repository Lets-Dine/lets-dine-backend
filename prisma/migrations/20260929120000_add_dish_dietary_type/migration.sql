-- AlterTable
ALTER TABLE "dishes" ADD COLUMN     "dietary_type" "DishDietaryType" NOT NULL DEFAULT 'NON_VEG';

-- Backfill from the old boolean before dropping it
UPDATE "dishes" SET "dietary_type" = 'VEG' WHERE "is_veg" = true;

-- AlterTable
ALTER TABLE "dishes" DROP COLUMN "is_veg";
