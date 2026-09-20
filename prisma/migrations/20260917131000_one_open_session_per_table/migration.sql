-- A table may have only one session that has not been explicitly ended.
-- Existing duplicate open sessions must be resolved before this migration runs.
CREATE UNIQUE INDEX "dining_sessions_one_open_per_table_idx"
ON "dining_sessions" ("table_id")
WHERE "ended_at" IS NULL;
