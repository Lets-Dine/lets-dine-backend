-- AlterTable: which printing session holds a job's claim
ALTER TABLE "print_jobs" ADD COLUMN "claimed_by" TEXT;
