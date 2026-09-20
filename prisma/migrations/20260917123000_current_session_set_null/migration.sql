-- AlterTable
ALTER TABLE "dining_tables" ADD COLUMN "current_session_id" UUID;

-- AddForeignKey
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_current_session_id_fkey" FOREIGN KEY ("current_session_id") REFERENCES "dining_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "dining_tables_current_session_id_idx" ON "dining_tables"("current_session_id");
