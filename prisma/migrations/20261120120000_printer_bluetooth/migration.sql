-- CreateEnum
CREATE TYPE "PrinterLink" AS ENUM ('NETWORK', 'BLUETOOTH');

-- AlterTable
ALTER TABLE "printers" ALTER COLUMN "ip_address" SET DEFAULT '';
ALTER TABLE "printers" ADD COLUMN "link" "PrinterLink" NOT NULL DEFAULT 'NETWORK';
ALTER TABLE "printers" ADD COLUMN "device_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "printers" ADD COLUMN "serial" BOOLEAN NOT NULL DEFAULT false;
