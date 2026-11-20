-- CreateTable
CREATE TABLE "restaurant_static_qrs" (
    "restaurant_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_static_qrs_pkey" PRIMARY KEY ("restaurant_id")
);

-- AddForeignKey
ALTER TABLE "restaurant_static_qrs" ADD CONSTRAINT "restaurant_static_qrs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
