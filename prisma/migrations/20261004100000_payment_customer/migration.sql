-- A payment records who paid, so a customer's spend can be read straight from payments.
ALTER TABLE "payments" ADD COLUMN "customer_id" UUID;

-- Existing table and delivery payments take the customer their visit's orders were placed under.
-- Floor payments are skipped: they settle one order each and don't record which one.
UPDATE "payments" p
SET "customer_id" = (
  SELECT o."customer_id" FROM "orders" o
  WHERE o."session_id" = p."session_id" AND o."customer_id" IS NOT NULL
  ORDER BY o."created_at" LIMIT 1
)
WHERE p."floor_id" IS NULL;

CREATE INDEX "payments_customer_id_idx" ON "payments"("customer_id");
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
