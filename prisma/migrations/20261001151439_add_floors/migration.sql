-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'floor_created';
ALTER TYPE "AuditAction" ADD VALUE 'floor_renamed';
ALTER TYPE "AuditAction" ADD VALUE 'floor_disabled';
ALTER TYPE "AuditAction" ADD VALUE 'floor_enabled';

-- AlterTable
ALTER TABLE "dining_sessions" ADD COLUMN     "floor_id" UUID;

-- AlterTable
ALTER TABLE "dining_tables" ADD COLUMN     "floor_id" UUID;

-- CreateTable
CREATE TABLE "floors" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "qr_token" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "floors_qr_token_key" ON "floors"("qr_token");

-- CreateIndex
CREATE INDEX "floors_restaurant_id_idx" ON "floors"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "floors_restaurant_id_name_key" ON "floors"("restaurant_id", "name");

-- CreateIndex
CREATE INDEX "dining_sessions_restaurant_id_floor_id_idx" ON "dining_sessions"("restaurant_id", "floor_id");

-- CreateIndex
CREATE INDEX "dining_tables_floor_id_idx" ON "dining_tables"("floor_id");

-- AddForeignKey
ALTER TABLE "dining_sessions" ADD CONSTRAINT "dining_sessions_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
