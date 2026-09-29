-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'DELIVERY');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'OUT_FOR_DELIVERY';

-- AlterTable
ALTER TABLE "dining_sessions" ADD COLUMN     "customer_id" UUID,
ALTER COLUMN "table_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_id" UUID,
ADD COLUMN     "delivery_address" TEXT,
ADD COLUMN     "delivery_customer_name" TEXT,
ADD COLUMN     "delivery_fee" INTEGER,
ADD COLUMN     "delivery_note" TEXT,
ADD COLUMN     "delivery_phone" TEXT,
ADD COLUMN     "order_type" "OrderType" NOT NULL DEFAULT 'DINE_IN',
ALTER COLUMN "table_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "table_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN     "delivery_fee_amount" INTEGER;

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_address" TEXT,
    "default_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_restaurant_id_phone_key" ON "customers"("restaurant_id", "phone");

-- CreateIndex
CREATE INDEX "orders_restaurant_id_order_type_idx" ON "orders"("restaurant_id", "order_type");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_sessions" ADD CONSTRAINT "dining_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

