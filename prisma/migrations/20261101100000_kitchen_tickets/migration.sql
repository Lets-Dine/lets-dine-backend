-- CreateEnum
CREATE TYPE "KitchenStation" AS ENUM ('KITCHEN', 'BAR');

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "ack_stations" "KitchenStation"[] DEFAULT ARRAY[]::"KitchenStation"[],
ADD COLUMN     "ticket_seq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "dishes" ADD COLUMN     "station" "KitchenStation" NOT NULL DEFAULT 'KITCHEN';

-- CreateTable
CREATE TABLE "kitchen_tickets" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "station" "KitchenStation" NOT NULL,
    "number" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "printed_at" TIMESTAMP(3),

    CONSTRAINT "kitchen_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kitchen_ticket_lines" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "order_item_id" UUID,
    "qty_delta" INTEGER NOT NULL,
    "dish_name_snapshot" TEXT NOT NULL,
    "variant_name_snapshot" TEXT,
    "add_on_names" TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "kitchen_ticket_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kitchen_tickets_branch_id_station_created_at_idx" ON "kitchen_tickets"("branch_id", "station", "created_at");

-- CreateIndex
CREATE INDEX "kitchen_tickets_order_id_idx" ON "kitchen_tickets"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "kitchen_tickets_branch_id_number_key" ON "kitchen_tickets"("branch_id", "number");

-- CreateIndex
CREATE INDEX "kitchen_ticket_lines_ticket_id_idx" ON "kitchen_ticket_lines"("ticket_id");

-- CreateIndex
CREATE INDEX "kitchen_ticket_lines_order_item_id_idx" ON "kitchen_ticket_lines"("order_item_id");

-- AddForeignKey
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_tickets" ADD CONSTRAINT "kitchen_tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kitchen_ticket_lines" ADD CONSTRAINT "kitchen_ticket_lines_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "kitchen_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

