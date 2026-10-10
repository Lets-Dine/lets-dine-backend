-- CreateEnum
CREATE TYPE "public"."StockMovementReason" AS ENUM ('DELIVERY', 'ORDER', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "public"."dishes" ADD COLUMN "auto_sold_out" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."ingredients" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "par_level" INTEGER NOT NULL DEFAULT 0,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."recipe_lines" (
    "id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "variant_id" UUID,
    "add_on_id" UUID,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stock_movements" (
    "id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" "public"."StockMovementReason" NOT NULL,
    "supplier" TEXT,
    "cost" INTEGER,
    "order_item_id" UUID,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ingredients_restaurant_id_idx" ON "public"."ingredients"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_branch_id_name_key" ON "public"."ingredients"("branch_id", "name");

-- CreateIndex
CREATE INDEX "recipe_lines_dish_id_idx" ON "public"."recipe_lines"("dish_id");

-- CreateIndex
CREATE INDEX "recipe_lines_ingredient_id_idx" ON "public"."recipe_lines"("ingredient_id");

-- CreateIndex
CREATE INDEX "stock_movements_ingredient_id_created_at_idx" ON "public"."stock_movements"("ingredient_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_order_item_id_idx" ON "public"."stock_movements"("order_item_id");

-- AddForeignKey
ALTER TABLE "public"."ingredients" ADD CONSTRAINT "ingredients_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ingredients" ADD CONSTRAINT "ingredients_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."recipe_lines" ADD CONSTRAINT "recipe_lines_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."recipe_lines" ADD CONSTRAINT "recipe_lines_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stock_movements" ADD CONSTRAINT "stock_movements_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
