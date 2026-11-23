-- AlterTable
ALTER TABLE "public"."restaurants" ADD COLUMN "vat_registered" BOOLEAN NOT NULL DEFAULT false;

-- Until now a number plus a tax rate meant "tax invoice", so those restaurants keep issuing them.
UPDATE "public"."restaurants" SET "vat_registered" = true WHERE "vat_pan_number" IS NOT NULL AND "tax_rate" > 0;
