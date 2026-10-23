-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('APP', 'WHATSAPP');

-- AlterTable
ALTER TABLE "restaurants" ADD COLUMN "delivery_channel" "DeliveryChannel" NOT NULL DEFAULT 'APP',
ADD COLUMN "whatsapp_number" TEXT;
