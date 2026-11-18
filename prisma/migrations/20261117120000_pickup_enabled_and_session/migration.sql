ALTER TABLE "restaurants" ADD COLUMN "pickup_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "dining_sessions" ADD COLUMN "pickup" BOOLEAN NOT NULL DEFAULT false;
