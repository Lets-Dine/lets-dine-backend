-- Defensive backfill for rows written since the default-branch backfill: take the branch from the
-- table/floor the row belongs to, falling back to the restaurant's default branch (delivery).
UPDATE "dining_sessions" s SET "branch_id" = t."branch_id" FROM "dining_tables" t WHERE s."table_id" = t."id" AND s."branch_id" IS NULL;
UPDATE "dining_sessions" s SET "branch_id" = f."branch_id" FROM "floors" f WHERE s."floor_id" = f."id" AND s."branch_id" IS NULL;
UPDATE "dining_sessions" s SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = s."restaurant_id" AND b."is_default" AND s."branch_id" IS NULL;
UPDATE "orders" o SET "branch_id" = s."branch_id" FROM "dining_sessions" s WHERE o."session_id" = s."id" AND o."branch_id" IS NULL;
UPDATE "payments" p SET "branch_id" = s."branch_id" FROM "dining_sessions" s WHERE p."session_id" = s."id" AND p."branch_id" IS NULL;

-- DropIndex
DROP INDEX "orders_restaurant_id_reference_key";

-- AlterTable
ALTER TABLE "dining_sessions" ALTER COLUMN "branch_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "branch_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "branch_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "orders_branch_id_reference_key" ON "orders"("branch_id", "reference");

