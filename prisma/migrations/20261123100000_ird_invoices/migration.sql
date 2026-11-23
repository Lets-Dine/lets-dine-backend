-- CreateEnum
CREATE TYPE "public"."InvoiceSeries" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- AlterTable
ALTER TABLE "public"."payments"
  ADD COLUMN "fiscal_year" TEXT,
  ADD COLUMN "invoice_number" INTEGER,
  ADD COLUMN "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "buyer_name" TEXT,
  ADD COLUMN "buyer_pan" TEXT,
  ADD COLUMN "print_count" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "public"."payment_refunds"
  ADD COLUMN "fiscal_year" TEXT,
  ADD COLUMN "credit_note_number" INTEGER,
  ADD COLUMN "tax_reversed" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."invoice_counters" (
    "restaurant_id" UUID NOT NULL,
    "fiscal_year" TEXT NOT NULL,
    "series" "public"."InvoiceSeries" NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("restaurant_id","fiscal_year","series")
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_restaurant_id_fiscal_year_invoice_number_key" ON "public"."payments"("restaurant_id", "fiscal_year", "invoice_number");
CREATE UNIQUE INDEX "payment_refunds_restaurant_id_fiscal_year_credit_note_numbe_key" ON "public"."payment_refunds"("restaurant_id", "fiscal_year", "credit_note_number");

-- AddForeignKey
ALTER TABLE "public"."invoice_counters" ADD CONSTRAINT "invoice_counters_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
