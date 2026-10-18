ALTER TABLE "public"."stock_lots" ADD COLUMN "expires_at" TIMESTAMP(3);

CREATE INDEX "stock_lots_expires_at_idx" ON "public"."stock_lots"("expires_at");
