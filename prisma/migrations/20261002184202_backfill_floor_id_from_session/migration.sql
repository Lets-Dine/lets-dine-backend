-- Backfill `floor_id` on existing rows from the session they were placed
-- under, now that it's a direct column instead of read-side joined through
-- `dining_sessions.floor_id`. Only ever touches a row that was actually a
-- floor order/payment (`ds.floor_id IS NOT NULL`); everything else stays null.
UPDATE "orders" o
SET "floor_id" = ds."floor_id"
FROM "dining_sessions" ds
WHERE o."session_id" = ds."id"
  AND ds."floor_id" IS NOT NULL
  AND o."floor_id" IS NULL;

UPDATE "payments" p
SET "floor_id" = ds."floor_id"
FROM "dining_sessions" ds
WHERE p."session_id" = ds."id"
  AND ds."floor_id" IS NOT NULL
  AND p."floor_id" IS NULL;
