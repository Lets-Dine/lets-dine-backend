import { PaymentStatus } from "@prisma/client";
import { ITransaction } from "../interfaces/transaction.interface";
import { allocatePaid, ICreditLot } from "./purchase-allocation.util";

type Lot = ICreditLot & { ingredient: string; unit: string };

const statusOf = (cost: number, paid: number) =>
  paid >= cost ? PaymentStatus.PAID : paid > 0 ? PaymentStatus.PARTIALLY_PAID : PaymentStatus.UNPAID;

/**
 * Credit deliveries as purchases. The goods arrive and the debt is recorded, but no cash moves — only a
 * supplier payment does, and that is already a cash-book row. Cash deliveries are not here: they posted
 * their own expense when they arrived.
 */
export function purchaseTransactions(lots: Lot[], settled: Map<string, number>): ITransaction[] {
  const paid = allocatePaid(lots, settled);
  return lots.map(lot => {
    const paidAmount = paid.get(lot.id) ?? 0;
    return {
      id: `STOCK_LOT:${lot.id}`,
      type: "PURCHASE",
      category: "stock",
      description: `${lot.ingredient} (${lot.unit}) from ${lot.supplier}, on credit`,
      totalAmount: lot.cost,
      paidAmount,
      outstandingAmount: lot.cost - paidAmount,
      paymentStatus: statusOf(lot.cost, paidAmount),
      transactionDate: lot.receivedAt,
      dueDate: null,
      counterparty: { kind: "SUPPLIER", id: null, name: lot.supplier },
      source: { type: "STOCK_LOT", id: lot.id },
      saleId: null,
      refundedAmount: 0,
      createdByName: null,
    };
  });
}
