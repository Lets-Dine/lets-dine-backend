import { DeliverySettlementDirection, DeliverySettlementMethod, ExpenseKind, PaymentMethod } from "@prisma/client";

export const DELIVERY_CASH_CATEGORY = "Delivery cash";
export const DELIVERY_FEES_CATEGORY = "Delivery fees";

export interface ILedgerPosting {
  kind: ExpenseKind;
  amount: number;
  method: PaymentMethod;
  category: string;
}

/**
 * The cash-book rows a courier settlement posts. `amount` is the money that really moved, so it is what
 * the drawer or the bank changes by. `offset` is cleared on the other side in the same act (fees netted off
 * a collection, cash netted off a payout): it posts as an income and an expense of the same size on the same
 * account, which show the gross figures and cancel to nothing in the balance.
 *
 *   COLLECT 85,000 + 5,000 netted  →  income 90,000 + expense 5,000  →  drawer +85,000
 *   PAYOUT  20,000 + 4,000 netted  →  expense 24,000 + income 4,000  →  drawer −20,000
 *
 * A bank or wallet transfer lands on the bank side (CARD), the way every off-cash entry does.
 */
export function ledgerPostingsFor(settlement: {
  direction: DeliverySettlementDirection;
  amount: number;
  offset: number;
  method: DeliverySettlementMethod;
}): ILedgerPosting[] {
  const method = settlement.method === DeliverySettlementMethod.CASH ? PaymentMethod.CASH : PaymentMethod.CARD;
  const collect = settlement.direction === DeliverySettlementDirection.COLLECT;
  const postings: ILedgerPosting[] = [
    {
      kind: ExpenseKind.INCOME,
      amount: collect ? settlement.amount + settlement.offset : settlement.offset,
      method,
      category: DELIVERY_CASH_CATEGORY,
    },
    {
      kind: ExpenseKind.EXPENSE,
      amount: collect ? settlement.offset : settlement.amount + settlement.offset,
      method,
      category: DELIVERY_FEES_CATEGORY,
    },
  ];
  return postings.filter(posting => posting.amount > 0);
}
