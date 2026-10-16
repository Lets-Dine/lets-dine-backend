-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');
CREATE TYPE "public"."TenderStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."payments"
  ADD COLUMN "paid_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refunded_amount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "payment_status" "public"."PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "due_date" TIMESTAMP(3),
  ADD COLUMN "idempotency_key" TEXT;

ALTER TABLE "public"."expenses" ADD COLUMN "payment_refund_id" UUID;

-- CreateTable
CREATE TABLE "public"."payment_tenders" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "status" "public"."TenderStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "reference" TEXT NOT NULL DEFAULT '',
    "idempotency_key" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "created_by_name" TEXT,
    CONSTRAINT "payment_tenders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_tenders_amount_positive" CHECK ("amount" > 0)
);

CREATE TABLE "public"."payment_refunds" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "tender_id" UUID,
    "amount" INTEGER NOT NULL,
    "method" "public"."PaymentMethod" NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "created_by_name" TEXT,
    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_refunds_amount_positive" CHECK ("amount" > 0)
);

-- Backfill: every historical payment was a full, single-method charge. One tender per payment, same instant and method.
INSERT INTO "public"."payment_tenders" ("id", "restaurant_id", "branch_id", "payment_id", "amount", "method", "status", "paid_at", "created_at", "created_by", "created_by_name")
SELECT gen_random_uuid(), "restaurant_id", "branch_id", "id", "total", "method", 'SUCCEEDED', "created_at", "created_at", "created_by", "created_by_name"
FROM "public"."payments" WHERE "total" > 0;

-- A bill can never have collected a negative amount: any historical negative total is treated as owing nothing.
UPDATE "public"."payments" SET "paid_amount" = GREATEST("total", 0), "payment_status" = 'PAID';

-- Money stays inside its bounds even under concurrent writers.
ALTER TABLE "public"."payments"
  ADD CONSTRAINT "payments_paid_within_total" CHECK ("paid_amount" >= 0 AND "paid_amount" <= GREATEST("total", 0)),
  ADD CONSTRAINT "payments_refunded_within_paid" CHECK ("refunded_amount" >= 0 AND "refunded_amount" <= "paid_amount");

-- CreateIndex
CREATE UNIQUE INDEX "payments_restaurant_id_idempotency_key_key" ON "public"."payments"("restaurant_id", "idempotency_key");
CREATE INDEX "payments_branch_id_payment_status_idx" ON "public"."payments"("branch_id", "payment_status");
CREATE UNIQUE INDEX "expenses_payment_refund_id_key" ON "public"."expenses"("payment_refund_id");
CREATE UNIQUE INDEX "payment_tenders_restaurant_id_idempotency_key_key" ON "public"."payment_tenders"("restaurant_id", "idempotency_key");
CREATE INDEX "payment_tenders_payment_id_idx" ON "public"."payment_tenders"("payment_id");
CREATE INDEX "payment_tenders_branch_id_paid_at_idx" ON "public"."payment_tenders"("branch_id", "paid_at");
CREATE UNIQUE INDEX "payment_refunds_restaurant_id_idempotency_key_key" ON "public"."payment_refunds"("restaurant_id", "idempotency_key");
CREATE INDEX "payment_refunds_payment_id_idx" ON "public"."payment_refunds"("payment_id");
CREATE INDEX "payment_refunds_branch_id_created_at_idx" ON "public"."payment_refunds"("branch_id", "created_at");

-- AddForeignKey
ALTER TABLE "public"."payment_tenders" ADD CONSTRAINT "payment_tenders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."payment_tenders" ADD CONSTRAINT "payment_tenders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."payment_tenders" ADD CONSTRAINT "payment_tenders_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."payment_refunds" ADD CONSTRAINT "payment_refunds_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."payment_refunds" ADD CONSTRAINT "payment_refunds_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
