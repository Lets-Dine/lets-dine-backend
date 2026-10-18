-- CreateTable
CREATE TABLE "public"."receivable_reminders" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "created_by_name" TEXT,

    CONSTRAINT "receivable_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "receivable_reminders_restaurant_id_customer_id_created_at_idx" ON "public"."receivable_reminders"("restaurant_id", "customer_id", "created_at");

ALTER TABLE "public"."receivable_reminders" ADD CONSTRAINT "receivable_reminders_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."receivable_reminders" ADD CONSTRAINT "receivable_reminders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
