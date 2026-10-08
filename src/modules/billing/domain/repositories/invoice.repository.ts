import { InvoiceKind, InvoiceStatus } from "@prisma/client";
import { PaginatedResponse } from "../../../../common/interfaces";
import { IPaginationOptions } from "../../../../common/interfaces/pagination.interface";
import { PrismaTransaction } from "../../../../common/prisma";
import { IInvoice, IInvoiceLine } from "../interfaces/billing.interface";

export interface IInvoiceCreate {
  subscriptionId: string;
  restaurantId: string;
  number: string;
  lines: IInvoiceLine[];
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  dueAt: Date;
  kind?: InvoiceKind;
  upgradePlanId?: string;
}

export interface IInvoiceFetchQuery {
  restaurantId?: string;
  status?: InvoiceStatus;
}

export interface IInvoicePayment {
  paidAt: Date;
  paymentMethod: string;
  paymentRef: string | null;
  markedPaidBy: string | null;
}

export interface IInvoiceOptions {
  tx?: PrismaTransaction;
}

export interface IInvoiceFetchOptions extends IPaginationOptions, IInvoiceOptions {}

export abstract class InvoiceRepository {
  abstract $transaction<T>(fn: (tx: PrismaTransaction) => Promise<T>): Promise<T>;
  abstract create(data: IInvoiceCreate, options?: IInvoiceOptions): Promise<IInvoice>;
  abstract findById(id: string, options?: IInvoiceOptions): Promise<IInvoice | null>;
  abstract fetchAll(query: IInvoiceFetchQuery, options?: IInvoiceFetchOptions): Promise<PaginatedResponse<IInvoice>>;
  /**
   * Closes the invoice only if it is still open, and says whether it did. The
   * conditional write is what stops two simultaneous payments both succeeding.
   */
  abstract markPaidIfOpen(id: string, payment: IInvoicePayment, options?: IInvoiceOptions): Promise<boolean>;
  /**
   * Books a paid invoice as an expense in the restaurant's default branch ledger, so the cash book
   * shows what the subscription cost. Off-cash (card/bank/eSewa) unless it was paid in cash.
   * Reads the ledger table directly: billing imports no feature module.
   */
  abstract recordAsExpense(invoice: IInvoice, options?: IInvoiceOptions): Promise<void>;
  /** Voids every open invoice of a subscription (or just one `kind`), optionally sparing one. Returns how many were voided. */
  abstract voidOpenForSubscription(subscriptionId: string, options?: IInvoiceOptions & { exceptId?: string; kind?: InvoiceKind }): Promise<number>;
}
