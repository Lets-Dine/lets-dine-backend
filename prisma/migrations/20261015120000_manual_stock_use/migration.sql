ALTER TYPE "public"."StockMovementReason" ADD VALUE 'MANUAL_USE';
ALTER TABLE "public"."stock_movements" ADD COLUMN "dish_id" UUID;
