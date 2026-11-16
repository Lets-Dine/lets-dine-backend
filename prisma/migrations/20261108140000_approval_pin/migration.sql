-- AlterTable
ALTER TABLE "users" ADD COLUMN     "approval_pin_hash" TEXT;

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'approval_pin_changed';
