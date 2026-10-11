import { DeliverySettlementDirection } from "@prisma/client";
import { DELIVERY_ERROR_MESSAGES } from "../constants";

/**
 * A courier account's balance is `cash held − fees owed`. Positive: they hold the branch's cash.
 * Negative: the branch owes them. A settlement moves money (`amount`) and may clear the other side
 * in the same act (`offset`), so a settle-to-zero leaves both gross lines at zero.
 */
export interface IAccountTotals {
  /** Cash collected at the door across delivered runs. */
  cashCollected: number;
  /** Fees earned across delivered runs. */
  feesEarned: number;
  /** Sum of COLLECT settlement amounts (cash handed over). */
  collected: number;
  /** Sum of PAYOUT settlement amounts (fees paid out). */
  paidOut: number;
  /** Sum of every settlement's offset. It clears cash and fees alike. */
  offsets: number;
}

export interface IAccountBalance {
  cashHeld: number;
  feesOwed: number;
  net: number;
}

export function accountBalance(totals: IAccountTotals): IAccountBalance {
  const cashHeld = totals.cashCollected - totals.collected - totals.offsets;
  const feesOwed = totals.feesEarned - totals.paidOut - totals.offsets;
  return { cashHeld, feesOwed, net: cashHeld - feesOwed };
}

/** Which side a settlement would push below zero, if any — null when the books stay honest. */
export function settlementProblem(
  balance: Pick<IAccountBalance, "cashHeld" | "feesOwed">,
  direction: DeliverySettlementDirection,
  amount: number,
  offset: number
): typeof DELIVERY_ERROR_MESSAGES.SETTLE_TOO_MUCH_CASH | typeof DELIVERY_ERROR_MESSAGES.SETTLE_TOO_MUCH_FEES | null {
  const cashCleared = (direction === DeliverySettlementDirection.COLLECT ? amount : 0) + offset;
  const feesCleared = (direction === DeliverySettlementDirection.PAYOUT ? amount : 0) + offset;
  if (cashCleared > Math.max(balance.cashHeld, 0)) return DELIVERY_ERROR_MESSAGES.SETTLE_TOO_MUCH_CASH;
  if (feesCleared > Math.max(balance.feesOwed, 0)) return DELIVERY_ERROR_MESSAGES.SETTLE_TOO_MUCH_FEES;
  return null;
}
