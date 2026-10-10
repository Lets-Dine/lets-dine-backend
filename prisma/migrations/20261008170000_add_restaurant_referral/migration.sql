-- AlterTable
ALTER TABLE "public"."restaurants" ADD COLUMN "referred_by_restaurant_id" UUID,
ADD COLUMN "referral_rewarded_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "restaurants_referred_by_restaurant_id_idx" ON "public"."restaurants"("referred_by_restaurant_id");

-- AddForeignKey
ALTER TABLE "public"."restaurants" ADD CONSTRAINT "restaurants_referred_by_restaurant_id_fkey" FOREIGN KEY ("referred_by_restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
