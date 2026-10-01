-- DropForeignKey
ALTER TABLE "dining_tables" DROP CONSTRAINT "dining_tables_floor_id_fkey";

-- DropIndex
DROP INDEX "dining_tables_floor_id_idx";

-- AlterTable
ALTER TABLE "dining_sessions" ADD COLUMN     "floor_visitor_name" TEXT;

-- AlterTable
ALTER TABLE "dining_tables" DROP COLUMN "floor_id";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "floor_visitor_name" TEXT;

