-- AlterTable
ALTER TABLE "loyalty_programs" ADD COLUMN     "review_bonus" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "loyalty_entries" ADD COLUMN     "order_id" UUID;

-- CreateIndex
CREATE INDEX "loyalty_entries_order_id_idx" ON "loyalty_entries"("order_id");

-- AddForeignKey
ALTER TABLE "loyalty_entries" ADD CONSTRAINT "loyalty_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
