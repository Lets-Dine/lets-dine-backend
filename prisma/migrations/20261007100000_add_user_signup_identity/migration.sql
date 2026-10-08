-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_key" TEXT,
ADD COLUMN "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key_key" ON "users"("email_key");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
