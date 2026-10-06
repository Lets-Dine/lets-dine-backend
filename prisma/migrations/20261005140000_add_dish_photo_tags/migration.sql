-- AlterTable
ALTER TABLE "dish_photos" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
