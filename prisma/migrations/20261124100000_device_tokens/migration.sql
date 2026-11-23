-- CreateTable
CREATE TABLE "public"."device_tokens" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "member_id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "public"."device_tokens"("token");
CREATE INDEX "device_tokens_restaurant_id_branch_id_idx" ON "public"."device_tokens"("restaurant_id", "branch_id");
CREATE INDEX "device_tokens_member_id_idx" ON "public"."device_tokens"("member_id");

-- AddForeignKey
ALTER TABLE "public"."device_tokens" ADD CONSTRAINT "device_tokens_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."restaurant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
