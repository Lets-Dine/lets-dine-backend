-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('SUBSCRIPTION', 'USAGE');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'RESTRICTED', 'SUSPENDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "paid_at" TIMESTAMP(3),
    "payment_method" TEXT,
    "payment_ref" TEXT,
    "marked_paid_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PlanType" NOT NULL DEFAULT 'SUBSCRIPTION',
    "monthly_price" INTEGER NOT NULL DEFAULT 0,
    "annual_price" INTEGER NOT NULL DEFAULT 0,
    "extra_branch_price" INTEGER,
    "extra_seat_price" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "limits" JSONB NOT NULL,
    "features" JSONB NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "trial_ends_at" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "past_due_since" TIMESTAMP(3),
    "pending_plan_id" UUID,
    "extra_branches" INTEGER NOT NULL DEFAULT 0,
    "extra_seats" INTEGER NOT NULL DEFAULT 0,
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "orders" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_restaurant_id_status_idx" ON "invoices"("restaurant_id", "status");

-- CreateIndex
CREATE INDEX "invoices_status_due_at_idx" ON "invoices"("status", "due_at");

-- CreateIndex
CREATE INDEX "invoices_subscription_id_idx" ON "invoices"("subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_restaurant_id_key" ON "subscriptions"("restaurant_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

-- CreateIndex
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_restaurant_id_period_start_key" ON "usage_counters"("restaurant_id", "period_start");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default plans. Prices are minor units (paisa) and are placeholder
-- hypotheses; limits/features are read only by the entitlement service, and a
-- missing limit key means unlimited.
INSERT INTO "plans" ("id", "key", "name", "type", "monthly_price", "annual_price", "extra_branch_price", "extra_seat_price", "currency", "limits", "features", "is_public", "is_active", "updated_at")
VALUES
  (gen_random_uuid(), 'starter', 'Starter', 'SUBSCRIPTION', 150000, 1500000, NULL, NULL, 'NPR',
   '{"branches": 1, "staffSeats": 5, "ordersPerMonth": 1000}'::jsonb,
   '{"analyticsTier": "basic", "exports": false, "auditRetentionDays": 30}'::jsonb,
   true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'growth', 'Growth', 'SUBSCRIPTION', 400000, 4000000, 80000, NULL, 'NPR',
   '{"branches": 5, "staffSeats": 20, "ordersPerMonth": 10000}'::jsonb,
   '{"analyticsTier": "full", "exports": true, "auditRetentionDays": 365}'::jsonb,
   true, true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'enterprise', 'Enterprise', 'SUBSCRIPTION', 0, 0, NULL, NULL, 'NPR',
   '{}'::jsonb,
   '{"analyticsTier": "full", "exports": true, "auditRetentionDays": 1095}'::jsonb,
   false, true, CURRENT_TIMESTAMP);

-- Backfill: every existing restaurant starts a 30-day trial on Growth (full
-- features), so the entitlement checks never block a restaurant that predates billing.
INSERT INTO "subscriptions" ("id", "restaurant_id", "plan_id", "status", "interval", "trial_ends_at", "current_period_start", "current_period_end", "updated_at")
SELECT gen_random_uuid(), r."id", p."id", 'TRIAL', 'MONTHLY',
       CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '30 days', CURRENT_TIMESTAMP
FROM "restaurants" r
CROSS JOIN (SELECT "id" FROM "plans" WHERE "key" = 'growth') p
WHERE NOT EXISTS (SELECT 1 FROM "subscriptions" s WHERE s."restaurant_id" = r."id");
