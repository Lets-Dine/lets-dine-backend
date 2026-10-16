-- AlterEnum (own migration: the new value cannot be used in the same transaction that adds it)
ALTER TYPE "public"."PaymentMethod" ADD VALUE 'QR';
