import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { ITenderCreate } from "../repositories/payment.repository";

/** UNPAID until something is collected, PAID once it covers the bill. */
export const statusOf = (total: number, paid: number): PaymentStatus =>
  paid >= total ? PaymentStatus.PAID : paid > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.UNPAID;

export const outstandingOf = (total: number, paid: number): number => Math.max(0, total - paid);

/** The collections a new bill starts with. A bill paid in full by one method — the usual till flow — passes no tenders. */
export function openingTenders(total: number, method: PaymentMethod, tenders?: ITenderCreate[]) {
  const list = tenders ?? (total > 0 ? [{ method, amount: total }] : []);
  const paidAmount = list.reduce((sum, t) => sum + t.amount, 0);
  return { tenders: list, paidAmount, paymentStatus: statusOf(total, paidAmount) };
}
