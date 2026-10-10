ALTER TYPE "public"."StockMovementReason" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "public"."StockMovementReason" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "AuditAction" ADD VALUE 'stock_transferred';
