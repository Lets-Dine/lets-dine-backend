-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "floor_id" UUID;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "floor_id" UUID;

-- CreateIndex
CREATE INDEX "orders_floor_id_idx" ON "orders"("floor_id");

-- CreateIndex
CREATE INDEX "payments_floor_id_idx" ON "payments"("floor_id");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
