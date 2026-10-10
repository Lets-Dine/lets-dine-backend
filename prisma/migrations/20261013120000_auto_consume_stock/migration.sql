ALTER TABLE "public"."restaurants" ADD COLUMN "auto_consume_stock" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "public"."branches" ADD COLUMN "auto_consume_stock" BOOLEAN;
ALTER TABLE "public"."dishes" ADD COLUMN "auto_consume_stock" BOOLEAN;
