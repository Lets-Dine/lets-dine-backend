-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'dish_variant_created';
ALTER TYPE "AuditAction" ADD VALUE 'dish_variant_updated';
ALTER TYPE "AuditAction" ADD VALUE 'dish_variant_archived';
ALTER TYPE "AuditAction" ADD VALUE 'dish_variant_restored';

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "variant_id" UUID,
ADD COLUMN     "variant_name_snapshot" TEXT,
ADD COLUMN     "variant_price_snapshot" INTEGER;

-- CreateTable
CREATE TABLE "dish_variants" (
    "id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "dish_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dish_variants_dish_id_idx" ON "dish_variants"("dish_id");

-- CreateIndex
CREATE INDEX "order_items_variant_id_idx" ON "order_items"("variant_id");

-- AddForeignKey
ALTER TABLE "dish_variants" ADD CONSTRAINT "dish_variants_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "dish_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
