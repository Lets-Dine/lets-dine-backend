-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "category" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "created_by_name" TEXT,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_closes" (
    "id" UUID NOT NULL,
    "restaurant_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "opening" INTEGER NOT NULL,
    "cash_sales" INTEGER NOT NULL,
    "card_sales" INTEGER NOT NULL,
    "cash_expenses" INTEGER NOT NULL,
    "card_expenses" INTEGER NOT NULL,
    "closing_expected" INTEGER NOT NULL,
    "closing_counted" INTEGER NOT NULL,
    "variance" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by" UUID,
    "closed_by_name" TEXT,

    CONSTRAINT "cash_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_branch_id_created_at_idx" ON "expenses"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "cash_closes_branch_id_closed_at_idx" ON "cash_closes"("branch_id", "closed_at");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closes" ADD CONSTRAINT "cash_closes_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closes" ADD CONSTRAINT "cash_closes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
