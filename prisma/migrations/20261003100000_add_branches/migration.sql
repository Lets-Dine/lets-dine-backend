-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "branch_id" UUID;

-- AlterTable
ALTER TABLE "dining_sessions" ADD COLUMN     "branch_id" UUID;

-- AlterTable
ALTER TABLE "dining_tables" ADD COLUMN     "branch_id" UUID;

-- AlterTable
ALTER TABLE "floors" ADD COLUMN     "branch_id" UUID;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "branch_id" UUID;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "branch_id" UUID;

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kathmandu',
    "service_charge_rate" DOUBLE PRECISION,
    "tax_rate" DOUBLE PRECISION,
    "delivery_fee_amount" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_hours" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "opens_at" TEXT NOT NULL,
    "closes_at" TEXT NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "branch_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_dishes" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "dish_id" UUID NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "price_override" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_members" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branches_restaurant_id_idx" ON "branches"("restaurant_id");

-- CreateIndex
CREATE UNIQUE INDEX "branches_restaurant_id_slug_key" ON "branches"("restaurant_id", "slug");

-- CreateIndex
CREATE INDEX "branch_hours_branch_id_day_of_week_idx" ON "branch_hours"("branch_id", "day_of_week");

-- CreateIndex
CREATE INDEX "branch_dishes_dish_id_idx" ON "branch_dishes"("dish_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_dishes_branch_id_dish_id_key" ON "branch_dishes"("branch_id", "dish_id");

-- CreateIndex
CREATE INDEX "branch_members_branch_id_idx" ON "branch_members"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_members_member_id_branch_id_key" ON "branch_members"("member_id", "branch_id");

-- CreateIndex
CREATE INDEX "audit_logs_branch_id_idx" ON "audit_logs"("branch_id");

-- CreateIndex
CREATE INDEX "dining_sessions_branch_id_idx" ON "dining_sessions"("branch_id");

-- CreateIndex
CREATE INDEX "dining_tables_branch_id_idx" ON "dining_tables"("branch_id");

-- CreateIndex
CREATE INDEX "floors_branch_id_idx" ON "floors"("branch_id");

-- CreateIndex
CREATE INDEX "orders_branch_id_idx" ON "orders"("branch_id");

-- CreateIndex
CREATE INDEX "payments_branch_id_idx" ON "payments"("branch_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_hours" ADD CONSTRAINT "branch_hours_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_dishes" ADD CONSTRAINT "branch_dishes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_dishes" ADD CONSTRAINT "branch_dishes_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_members" ADD CONSTRAINT "branch_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "restaurant_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_members" ADD CONSTRAINT "branch_members_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_sessions" ADD CONSTRAINT "dining_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- At most one default branch per restaurant (partial unique index; not expressible in Prisma).
CREATE UNIQUE INDEX "branches_one_default_per_restaurant_idx" ON "branches"("restaurant_id") WHERE "is_default";
