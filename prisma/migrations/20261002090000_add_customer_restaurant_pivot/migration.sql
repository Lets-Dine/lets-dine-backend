-- A `Customer` used to be scoped one-to-one with a restaurant (unique on
-- `(restaurant_id, phone)`), so the same phone number ordering from two
-- restaurants produced two separate rows. This migration makes `Customer`
-- a single global identity per phone, and moves the restaurant relationship
-- (plus its per-restaurant defaults) into a new `customer_restaurants` pivot.

-- CreateTable
CREATE TABLE "customer_restaurants" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "default_address" TEXT,
    "default_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_restaurants_pkey" PRIMARY KEY ("id")
);

-- Data backfill. Any phone number that already has more than one `customers`
-- row (one per restaurant, under the old constraint) collapses onto a single
-- canonical row — the oldest one — with a `customer_restaurants` row created
-- per restaurant it used to belong to.
DO $$
BEGIN
  -- One pivot row per pre-existing (restaurant, phone) pair, pointed at the
  -- canonical (oldest) customer row for that phone.
  INSERT INTO "customer_restaurants" ("id", "customer_id", "restaurant_id", "default_address", "default_note", "created_at", "updated_at")
  SELECT gen_random_uuid(), canonical.id, c."restaurant_id", c."default_address", c."default_note", c."created_at", c."updated_at"
  FROM "customers" c
  JOIN (
    SELECT DISTINCT ON ("phone") "id", "phone"
    FROM "customers"
    ORDER BY "phone", "created_at" ASC, "id" ASC
  ) canonical ON canonical."phone" = c."phone";

  -- Repoint every order/session that referenced a now-merged duplicate row
  -- onto its canonical survivor, before that duplicate is deleted below.
  UPDATE "orders" o
  SET "customer_id" = canonical.id
  FROM "customers" c
  JOIN (
    SELECT DISTINCT ON ("phone") "id", "phone"
    FROM "customers"
    ORDER BY "phone", "created_at" ASC, "id" ASC
  ) canonical ON canonical."phone" = c."phone"
  WHERE o."customer_id" = c."id" AND c."id" <> canonical."id";

  UPDATE "dining_sessions" s
  SET "customer_id" = canonical.id
  FROM "customers" c
  JOIN (
    SELECT DISTINCT ON ("phone") "id", "phone"
    FROM "customers"
    ORDER BY "phone", "created_at" ASC, "id" ASC
  ) canonical ON canonical."phone" = c."phone"
  WHERE s."customer_id" = c."id" AND c."id" <> canonical."id";

  -- The duplicate rows are now unreferenced — merged into their canonical
  -- row above, with a pivot row already created for the restaurant they
  -- belonged to.
  DELETE FROM "customers" c
  USING (
    SELECT DISTINCT ON ("phone") "id", "phone"
    FROM "customers"
    ORDER BY "phone", "created_at" ASC, "id" ASC
  ) canonical
  WHERE c."phone" = canonical."phone" AND c."id" <> canonical."id";
END $$;

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_restaurant_id_fkey";

-- DropIndex
DROP INDEX "customers_restaurant_id_phone_key";

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "default_address",
DROP COLUMN "default_note",
DROP COLUMN "restaurant_id";

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customer_restaurants_restaurant_id_idx" ON "customer_restaurants"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_restaurants_customer_id_restaurant_id_key" ON "customer_restaurants"("customer_id", "restaurant_id");

-- AddForeignKey
ALTER TABLE "customer_restaurants" ADD CONSTRAINT "customer_restaurants_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_restaurants" ADD CONSTRAINT "customer_restaurants_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
