-- AlterTable
ALTER TABLE "public"."supplier_returns" ADD COLUMN "owed_offset" INTEGER NOT NULL DEFAULT 0;

-- Returns recorded before this column took the whole refund off what was owed, when the delivery was on credit.
UPDATE "public"."supplier_returns" SET "owed_offset" = "amount" WHERE "on_credit";
