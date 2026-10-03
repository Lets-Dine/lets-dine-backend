-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'UNPAID';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paid_at" TIMESTAMP(3);
