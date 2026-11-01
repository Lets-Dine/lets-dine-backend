-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "discount_percent" INTEGER,
ADD COLUMN     "discount_ends_at" TIMESTAMP(3),
ADD COLUMN     "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "feature_overrides" JSONB;

-- CreateTable
CREATE TABLE "subscription_changes" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscription_changes_subscription_id_created_at_idx" ON "subscription_changes"("subscription_id", "created_at");

-- AddForeignKey
ALTER TABLE "subscription_changes" ADD CONSTRAINT "subscription_changes_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
