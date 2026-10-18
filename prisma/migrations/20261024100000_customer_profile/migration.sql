-- AlterTable
ALTER TABLE "public"."customer_restaurants"
  ADD COLUMN "email" TEXT,
  ADD COLUMN "birthday" TEXT,
  ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "offers_ok" BOOLEAN NOT NULL DEFAULT false;
