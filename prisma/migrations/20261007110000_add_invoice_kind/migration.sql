-- CreateEnum
CREATE TYPE "public"."InvoiceKind" AS ENUM ('RENEWAL', 'UPGRADE');

-- AlterTable
ALTER TABLE "public"."invoices" ADD COLUMN "kind" "public"."InvoiceKind" NOT NULL DEFAULT 'RENEWAL',
ADD COLUMN "upgrade_plan_id" UUID;
