-- A delivery order that has been handed over but not yet settled with its courier.
ALTER TYPE "OrderStatus" ADD VALUE 'SETTLE';

-- Settling an order settles that order's money with the courier; the settlement remembers which order.
ALTER TABLE "delivery_settlements" ADD COLUMN     "order_id" UUID;

CREATE INDEX "delivery_settlements_order_id_idx" ON "delivery_settlements"("order_id");

ALTER TABLE "delivery_settlements" ADD CONSTRAINT "delivery_settlements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
