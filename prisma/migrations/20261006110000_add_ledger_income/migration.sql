-- CreateEnum
CREATE TYPE "ExpenseKind" AS ENUM ('EXPENSE', 'INCOME');

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN "kind" "ExpenseKind" NOT NULL DEFAULT 'EXPENSE';

-- AlterTable
ALTER TABLE "cash_closes" ADD COLUMN "cash_income" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "card_income" INTEGER NOT NULL DEFAULT 0;
