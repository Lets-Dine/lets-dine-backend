-- AlterTable: every restaurant that exists today is already claimed
ALTER TABLE "restaurants" ADD COLUMN "google_url" TEXT,
ADD COLUMN "claimed_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "restaurant_claim_requests" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_claim_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restaurant_claim_requests_restaurant_id_idx" ON "restaurant_claim_requests"("restaurant_id");

-- AddForeignKey
ALTER TABLE "restaurant_claim_requests" ADD CONSTRAINT "restaurant_claim_requests_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
