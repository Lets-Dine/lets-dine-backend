ALTER TYPE "public"."StockMovementReason" ADD VALUE 'WASTE';

CREATE TYPE "public"."WasteReason" AS ENUM ('SPOILED', 'EXPIRED', 'SPILLED', 'TRIM', 'RETURNED', 'OTHER');

ALTER TABLE "public"."stock_movements" ADD COLUMN "waste_reason" "public"."WasteReason",
ADD COLUMN "waste_cost" INTEGER;

CREATE INDEX "stock_movements_reason_created_at_idx" ON "public"."stock_movements"("reason", "created_at");
