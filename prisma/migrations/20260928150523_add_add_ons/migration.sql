-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'addon_created';
ALTER TYPE "AuditAction" ADD VALUE 'addon_updated';
ALTER TYPE "AuditAction" ADD VALUE 'addon_archived';
ALTER TYPE "AuditAction" ADD VALUE 'addon_restored';
ALTER TYPE "AuditAction" ADD VALUE 'dish_add_ons_updated';

-- CreateTable
CREATE TABLE "add_ons" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dish_add_ons" (
    "dish_id" UUID NOT NULL,
    "add_on_id" UUID NOT NULL,

    CONSTRAINT "dish_add_ons_pkey" PRIMARY KEY ("dish_id","add_on_id")
);

-- CreateTable
CREATE TABLE "order_item_add_ons" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "add_on_id" UUID NOT NULL,
    "name_snapshot" TEXT NOT NULL,
    "price_snapshot" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "add_ons_restaurant_id_idx" ON "add_ons"("restaurant_id");

-- CreateIndex
CREATE INDEX "dish_add_ons_add_on_id_idx" ON "dish_add_ons"("add_on_id");

-- CreateIndex
CREATE INDEX "order_item_add_ons_order_item_id_idx" ON "order_item_add_ons"("order_item_id");

-- AddForeignKey
ALTER TABLE "add_ons" ADD CONSTRAINT "add_ons_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_add_ons" ADD CONSTRAINT "dish_add_ons_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dish_add_ons" ADD CONSTRAINT "dish_add_ons_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "add_ons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_add_ons" ADD CONSTRAINT "order_item_add_ons_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_add_ons" ADD CONSTRAINT "order_item_add_ons_add_on_id_fkey" FOREIGN KEY ("add_on_id") REFERENCES "add_ons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
