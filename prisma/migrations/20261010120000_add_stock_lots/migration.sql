-- CreateTable
CREATE TABLE "public"."stock_lots" (
    "id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "supplier" TEXT,
    "cost" INTEGER,
    "quantity" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lot_consumptions" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_lots_ingredient_id_received_at_idx" ON "public"."stock_lots"("ingredient_id", "received_at");

-- CreateIndex
CREATE INDEX "lot_consumptions_lot_id_idx" ON "public"."lot_consumptions"("lot_id");

-- CreateIndex
CREATE INDEX "lot_consumptions_order_item_id_idx" ON "public"."lot_consumptions"("order_item_id");

-- AddForeignKey
ALTER TABLE "public"."stock_lots" ADD CONSTRAINT "stock_lots_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lot_consumptions" ADD CONSTRAINT "lot_consumptions_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "public"."stock_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Stock already on the shelf before lots existed becomes one opening lot per ingredient, so it can be traced too.
INSERT INTO "public"."stock_lots" ("id", "ingredient_id", "quantity", "remaining")
SELECT gen_random_uuid(), "id", "quantity", "quantity" FROM "public"."ingredients" WHERE "quantity" > 0;
