-- Defensive backfill: anything created since the default-branch backfill (before the code wrote branch_id).
UPDATE "dining_tables" t SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = t."restaurant_id" AND b."is_default" AND t."branch_id" IS NULL;
UPDATE "floors" t SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = t."restaurant_id" AND b."is_default" AND t."branch_id" IS NULL;

-- DropIndex
DROP INDEX "dining_tables_restaurant_id_name_key";

-- DropIndex
DROP INDEX "floors_restaurant_id_name_key";

-- AlterTable
ALTER TABLE "dining_tables" ALTER COLUMN "branch_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "floors" ALTER COLUMN "branch_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "dining_tables_branch_id_name_key" ON "dining_tables"("branch_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "floors_branch_id_name_key" ON "floors"("branch_id", "name");

