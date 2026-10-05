-- CreateTable
CREATE TABLE "dish_photos" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dish_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dish_photos_name_idx" ON "dish_photos"("name");
