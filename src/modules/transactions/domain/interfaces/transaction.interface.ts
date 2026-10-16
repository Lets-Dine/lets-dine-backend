import { PaymentStatus } from "@prisma/client";

/** Why the money was owed or moved — set by the record that created it, never read off a description. */
export type TransactionType = "SALE" | "PURCHASE" | "EXPENSE" | "INCOME" | "TRANSFER" | "REFUND" | "DELIVERY_FEE";

export type TransactionSourceType = "PAYMENT" | "STOCK_LOT" | "EXPENSE" | "PAYMENT_REFUND" | "DELIVERY_RUN";

/** One financial activity, paid or not. A read model over the business records — nothing here is stored twice. */
export interface ITransaction {
  /** `<sourceType>:<sourceId>`, unique across kinds. */
  id: string;
  type: TransactionType;
  category: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  /** `totalAmount - paidAmount`: a receivable for a sale, a payable for a purchase. */
  outstandingAmount: number;
  paymentStatus: PaymentStatus;
  transactionDate: Date;
  dueDate: Date | null;
  counterparty: { kind: "CUSTOMER" | "SUPPLIER" | "RIDER" | "PARTNER"; id: string | null; name: string } | null;
  source: { type: TransactionSourceType; id: string };
  /** The sale this row belongs to: itself for a sale, the original sale for a refund. Lets any row be traced back to what was sold. */
  saleId: string | null;
  /** Handed back so far, for a sale. */
  refundedAmount: number;
  createdByName: string | null;
}

export interface ITransactionSummary {
  /** Owed by customers, and how much of it is past its due date. */
  receivables: { outstanding: number; overdue: number; count: number };
  /** Owed to suppliers (credit deliveries not yet paid). */
  payables: { outstanding: number; count: number };
  /** Delivery fees earned by riders and partners and not yet paid out. */
  courierFees: { outstanding: number; count: number };
}
