-- AlterEnum
ALTER TYPE "public"."StockMovementReason" ADD VALUE 'RETURN';

-- CreateTable
CREATE TABLE "public"."supplier_returns" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "ingredient_id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "supplier" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "on_credit" BOOLEAN NOT NULL DEFAULT false,
    "method" "public"."PaymentMethod" NOT NULL DEFAULT 'CASH',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "supplier_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_returns_branch_id_supplier_idx" ON "public"."supplier_returns"("branch_id", "supplier");

-- CreateIndex
CREATE INDEX "supplier_returns_lot_id_idx" ON "public"."supplier_returns"("lot_id");
