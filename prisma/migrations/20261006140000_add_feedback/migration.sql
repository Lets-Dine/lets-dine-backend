-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('BUG', 'IDEA', 'QUESTION', 'PRAISE');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWING', 'DONE');

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID,
    "sender_id" UUID NOT NULL,
    "sender_name" TEXT NOT NULL,
    "sender_email" TEXT NOT NULL,
    "sender_role" "StaffRole" NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "message" TEXT NOT NULL,
    "screenshot_url" TEXT,
    "page_path" TEXT NOT NULL DEFAULT '',
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedback_status_created_at_idx" ON "feedback"("status", "created_at");

-- CreateIndex
CREATE INDEX "feedback_restaurant_id_idx" ON "feedback"("restaurant_id");

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
