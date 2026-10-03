-- Every restaurant gets one default branch, copying its timezone and fees so
-- single-location restaurants behave exactly as before. Fee overrides stay NULL
-- (= inherit from the restaurant) so later restaurant-level edits still apply.
INSERT INTO "branches" ("id", "restaurant_id", "name", "slug", "timezone", "is_default", "is_active", "created_at", "updated_at")
SELECT gen_random_uuid(), r."id", 'Main', 'main', r."timezone", true, true, now(), now()
FROM "restaurants" r
WHERE NOT EXISTS (SELECT 1 FROM "branches" b WHERE b."restaurant_id" = r."id");

-- Backfill branch_id on every branch-scoped table from its restaurant's default branch.
UPDATE "dining_tables" t SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = t."restaurant_id" AND b."is_default" AND t."branch_id" IS NULL;
UPDATE "floors" t SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = t."restaurant_id" AND b."is_default" AND t."branch_id" IS NULL;
UPDATE "dining_sessions" t SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = t."restaurant_id" AND b."is_default" AND t."branch_id" IS NULL;
UPDATE "orders" t SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = t."restaurant_id" AND b."is_default" AND t."branch_id" IS NULL;
UPDATE "payments" t SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = t."restaurant_id" AND b."is_default" AND t."branch_id" IS NULL;
UPDATE "audit_logs" t SET "branch_id" = b."id" FROM "branches" b WHERE b."restaurant_id" = t."restaurant_id" AND b."is_default" AND t."branch_id" IS NULL;
