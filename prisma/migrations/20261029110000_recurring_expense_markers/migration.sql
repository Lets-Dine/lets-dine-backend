-- AlterTable
ALTER TABLE "expenses" ADD COLUMN "recurring_expense_id" UUID,
ADD COLUMN "recurring_due_on" DATE;

-- CreateIndex
CREATE UNIQUE INDEX "expenses_recurring_expense_id_recurring_due_on_key" ON "expenses"("recurring_expense_id", "recurring_due_on");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recurring_expense_id_fkey" FOREIGN KEY ("recurring_expense_id") REFERENCES "recurring_expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
