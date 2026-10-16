import { PaymentStatus } from "@prisma/client";
import { ITransaction } from "../interfaces/transaction.interface";
import { allocatePaid, ICreditLot } from "./purchase-allocation.util";

/** One delivered run whose courier fee is owed to a rider or a partner. `supplier` carries the courier account id, so payouts are spread per account. */
export type ICourierRun = ICreditLot & { orderReference: string; accountKind: "RIDER" | "PARTNER"; accountName: string };

const statusOf = (fee: number, paid: number) =>
  paid >= fee ? PaymentStatus.PAID : paid > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.UNPAID;

/**
 * Courier fees as payables. The fee is earned when the run is delivered; whether it is paid is the account's balance
 * (payouts plus what was netted off) spread over its runs oldest first — the same sum the delivery ledger already keeps
 * as "fees owed", only shown per delivery. Paying it books the cash-book outflow, not this row.
 */
export function courierFeeTransactions(runs: ICourierRun[], settled: Map<string, number>): ITransaction[] {
  const paid = allocatePaid(runs, settled);
  return runs.map(run => {
    const paidAmount = paid.get(run.id) ?? 0;
    return {
      id: `DELIVERY_RUN:${run.id}`,
      type: "DELIVERY_FEE",
      category: "delivery",
      description: `Courier fee — ${run.accountName}, order ${run.orderReference}`,
      totalAmount: run.cost,
      paidAmount,
      outstandingAmount: run.cost - paidAmount,
      paymentStatus: statusOf(run.cost, paidAmount),
      transactionDate: run.receivedAt,
      dueDate: null,
      counterparty: { kind: run.accountKind, id: run.supplier, name: run.accountName },
      source: { type: "DELIVERY_RUN", id: run.id },
      saleId: null,
      refundedAmount: 0,
      createdByName: null,
    };
  });
}
