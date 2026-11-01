ALTER TABLE "payment_items" ADD COLUMN "order_item_id" UUID;

CREATE INDEX "payment_items_order_item_id_idx" ON "payment_items"("order_item_id");
