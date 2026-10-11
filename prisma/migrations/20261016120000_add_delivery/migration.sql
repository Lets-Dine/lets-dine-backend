-- CreateEnum
CREATE TYPE "DeliveryAssignmentStatus" AS ENUM ('ASSIGNED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "DeliveryAccountKind" AS ENUM ('PARTNER', 'RIDER');

-- CreateEnum
CREATE TYPE "DeliveryFeeModel" AS ENUM ('FLAT', 'PERCENT', 'NONE');

-- CreateEnum
CREATE TYPE "DeliveryRiderKind" AS ENUM ('STAFF', 'FREELANCE');

-- CreateEnum
CREATE TYPE "DeliveryRiderPayModel" AS ENUM ('SALARIED', 'PER_DELIVERY');

-- CreateEnum
CREATE TYPE "DeliverySettlementDirection" AS ENUM ('COLLECT', 'PAYOUT');

-- CreateEnum
CREATE TYPE "DeliverySettlementMethod" AS ENUM ('CASH', 'BANK');

-- CreateTable
CREATE TABLE "delivery_assignments" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_ref" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "order_total" INTEGER NOT NULL,
    "rider_id" UUID,
    "partner_id" UUID,
    "rider_name" TEXT,
    "partner_name" TEXT,
    "account_kind" "DeliveryAccountKind" NOT NULL,
    "account_id" UUID NOT NULL,
    "status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "courier_fee" INTEGER NOT NULL DEFAULT 0,
    "cash_to_collect" INTEGER NOT NULL DEFAULT 0,
    "cash_collected" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_partners" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "contact_person" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "fee_model" "DeliveryFeeModel" NOT NULL DEFAULT 'FLAT',
    "fee_value" INTEGER NOT NULL DEFAULT 0,
    "collects_cash" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "delivery_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_riders" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "partner_id" UUID,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "kind" "DeliveryRiderKind" NOT NULL DEFAULT 'STAFF',
    "vehicle" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "pay_model" "DeliveryRiderPayModel" NOT NULL DEFAULT 'SALARIED',
    "pay_value" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "delivery_riders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_settlements" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "account_kind" "DeliveryAccountKind" NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "DeliverySettlementDirection" NOT NULL,
    "amount" INTEGER NOT NULL,
    "offset" INTEGER NOT NULL DEFAULT 0,
    "method" "DeliverySettlementMethod" NOT NULL DEFAULT 'CASH',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "created_by_name" TEXT,

    CONSTRAINT "delivery_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_assignments_branch_id_status_idx" ON "delivery_assignments"("branch_id", "status");

-- CreateIndex
CREATE INDEX "delivery_assignments_order_id_idx" ON "delivery_assignments"("order_id");

-- CreateIndex
CREATE INDEX "delivery_assignments_account_kind_account_id_status_idx" ON "delivery_assignments"("account_kind", "account_id", "status");

-- CreateIndex
CREATE INDEX "delivery_partners_branch_id_is_active_idx" ON "delivery_partners"("branch_id", "is_active");

-- CreateIndex
CREATE INDEX "delivery_riders_branch_id_is_active_idx" ON "delivery_riders"("branch_id", "is_active");

-- CreateIndex
CREATE INDEX "delivery_riders_partner_id_idx" ON "delivery_riders"("partner_id");

-- CreateIndex
CREATE INDEX "delivery_settlements_branch_id_created_at_idx" ON "delivery_settlements"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "delivery_settlements_account_kind_account_id_created_at_idx" ON "delivery_settlements"("account_kind", "account_id", "created_at");

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "delivery_riders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "delivery_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partners" ADD CONSTRAINT "delivery_partners_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partners" ADD CONSTRAINT "delivery_partners_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_riders" ADD CONSTRAINT "delivery_riders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_riders" ADD CONSTRAINT "delivery_riders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_riders" ADD CONSTRAINT "delivery_riders_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "delivery_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_settlements" ADD CONSTRAINT "delivery_settlements_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_settlements" ADD CONSTRAINT "delivery_settlements_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

