-- CreateEnum
CREATE TYPE "public"."SupplierIssueKind" AS ENUM ('LATE', 'SHORT', 'QUALITY', 'OTHER');

-- AlterTable
ALTER TABLE "public"."stock_lots" ADD COLUMN "from_transfer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "on_credit" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."supplier_payments" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "supplier" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL DEFAULT 'CASH',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplier_issues" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "supplier" TEXT NOT NULL,
    "kind" "public"."SupplierIssueKind" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "created_by_name" TEXT,

    CONSTRAINT "supplier_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_payments_branch_id_supplier_idx" ON "public"."supplier_payments"("branch_id", "supplier");

-- CreateIndex
CREATE INDEX "supplier_issues_restaurant_id_supplier_idx" ON "public"."supplier_issues"("restaurant_id", "supplier");

-- AddForeignKey
ALTER TABLE "public"."supplier_payments" ADD CONSTRAINT "supplier_payments_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplier_issues" ADD CONSTRAINT "supplier_issues_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
