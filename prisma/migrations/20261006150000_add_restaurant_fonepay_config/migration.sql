-- CreateTable
CREATE TABLE "restaurant_fonepay_configs" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "merchant_code" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "secret_key" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_fonepay_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_fonepay_configs_restaurant_id_key" ON "restaurant_fonepay_configs"("restaurant_id");

-- AddForeignKey
ALTER TABLE "restaurant_fonepay_configs" ADD CONSTRAINT "restaurant_fonepay_configs_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
