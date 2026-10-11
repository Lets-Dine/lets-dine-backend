-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "delivery_settlement_id" UUID;

-- CreateIndex
CREATE INDEX "expenses_delivery_settlement_id_idx" ON "expenses"("delivery_settlement_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_delivery_settlement_id_fkey" FOREIGN KEY ("delivery_settlement_id") REFERENCES "delivery_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: settlements recorded before the cash book was fed by them get their rows now, the same two a
-- new settlement posts. Money that moved is `amount`; `offset` is cleared on the other side in the same act,
-- so it posts as a matching income and expense that cancel in the drawer. A COLLECT is cash coming in
-- (income) with the netted fees as an expense; a PAYOUT is fees going out (expense) with the netted cash as income.
INSERT INTO "expenses" ("id", "restaurant_id", "branch_id", "kind", "amount", "method", "category", "note", "created_at", "created_by", "created_by_name", "delivery_settlement_id")
SELECT
  gen_random_uuid(),
  s."restaurant_id",
  s."branch_id",
  entry.kind,
  entry.amount,
  CASE s."method" WHEN 'CASH' THEN 'CASH'::"PaymentMethod" ELSE 'CARD'::"PaymentMethod" END,
  entry.category,
  COALESCE(
    (SELECT p."name" FROM "delivery_partners" p WHERE s."account_kind" = 'PARTNER' AND p."id" = s."account_id"),
    (SELECT r."name" FROM "delivery_riders" r WHERE s."account_kind" = 'RIDER' AND r."id" = s."account_id"),
    'Courier'
  ) || CASE WHEN s."note" <> '' THEN ' · ' || s."note" ELSE '' END,
  s."created_at",
  s."created_by",
  s."created_by_name",
  s."id"
FROM "delivery_settlements" s
CROSS JOIN LATERAL (
  VALUES
    ('INCOME'::"ExpenseKind", CASE s."direction" WHEN 'COLLECT' THEN s."amount" + s."offset" ELSE s."offset" END, 'Delivery cash'),
    ('EXPENSE'::"ExpenseKind", CASE s."direction" WHEN 'COLLECT' THEN s."offset" ELSE s."amount" + s."offset" END, 'Delivery fees')
) AS entry(kind, amount, category)
WHERE entry.amount > 0
  AND NOT EXISTS (SELECT 1 FROM "expenses" e WHERE e."delivery_settlement_id" = s."id");
