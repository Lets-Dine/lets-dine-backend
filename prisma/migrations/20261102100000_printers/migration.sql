-- CreateEnum
CREATE TYPE "PaperWidth" AS ENUM ('MM80', 'MM58');

-- CreateTable
CREATE TABLE "printers" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "paper_width" "PaperWidth" NOT NULL DEFAULT 'MM80',
    "ip_address" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 9100,
    "full_kot" BOOLEAN NOT NULL DEFAULT false,
    "stations" "KitchenStation"[] DEFAULT ARRAY[]::"KitchenStation"[],
    "table_assignment" BOOLEAN NOT NULL DEFAULT false,
    "table_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "floor_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "printers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "printer_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "ticket_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimed_at" TIMESTAMP(3),
    "printed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "printers_branch_id_idx" ON "printers"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "printers_branch_id_name_key" ON "printers"("branch_id", "name");

-- CreateIndex
CREATE INDEX "print_jobs_branch_id_printed_at_idx" ON "print_jobs"("branch_id", "printed_at");

-- CreateIndex
CREATE INDEX "print_jobs_printer_id_idx" ON "print_jobs"("printer_id");

-- AddForeignKey
ALTER TABLE "printers" ADD CONSTRAINT "printers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_printer_id_fkey" FOREIGN KEY ("printer_id") REFERENCES "printers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

