export const DELIVERY_ERROR_MESSAGES = {
  PARTNER_NOT_FOUND: { key: "DELIVERY_PARTNER_NOT_FOUND", message: "This delivery partner no longer exists" },
  RIDER_NOT_FOUND: { key: "DELIVERY_RIDER_NOT_FOUND", message: "This rider no longer exists" },
  ORDER_NOT_FOUND: { key: "DELIVERY_ORDER_NOT_FOUND", message: "This order no longer exists" },
  NOT_A_DELIVERY_ORDER: { key: "DELIVERY_NOT_A_DELIVERY_ORDER", message: "Only a delivery order can be handed to a courier" },
  ORDER_CLOSED: { key: "DELIVERY_ORDER_CLOSED", message: "This order is already finished and can't be sent out" },
  COURIER_REQUIRED: { key: "DELIVERY_COURIER_REQUIRED", message: "Choose a rider or a delivery partner" },
  COURIER_INACTIVE: {
    key: "DELIVERY_COURIER_INACTIVE",
    message: "That courier is switched off. Turn them back on to send an order out with them.",
  },
  RIDER_PARTNER_MISMATCH: { key: "DELIVERY_RIDER_PARTNER_MISMATCH", message: "That rider rides for a different partner" },
  PARTNER_DOES_NOT_COLLECT: { key: "DELIVERY_PARTNER_DOES_NOT_COLLECT", message: "This partner does not collect cash from customers" },
  CASH_EXCEEDS_TOTAL: { key: "DELIVERY_CASH_EXCEEDS_TOTAL", message: "The cash to collect can't be more than the order total" },
  INVALID_PERCENT: { key: "DELIVERY_INVALID_PERCENT", message: "A percentage fee can't be more than 100%" },
  INVALID_CURSOR: { key: "DELIVERY_INVALID_CURSOR", message: "That page of the statement is not valid" },
  ACCOUNT_NOT_FOUND: { key: "DELIVERY_ACCOUNT_NOT_FOUND", message: "That courier account no longer exists" },
  ACCOUNT_VIA_PARTNER: {
    key: "DELIVERY_ACCOUNT_VIA_PARTNER",
    message: "This rider rides for a partner, so their cash and fees settle with the partner",
  },
  ORDER_NOT_TO_SETTLE: {
    key: "DELIVERY_ORDER_NOT_TO_SETTLE",
    message: "This order isn't waiting to be settled. Mark it delivered first.",
  },
  FEE_NEEDS_MANAGER: {
    key: "DELIVERY_FEE_NEEDS_MANAGER",
    message: "Only a manager can pay a courier's fee. Settle the order and leave the fee to be paid later.",
  },
  COLLECT_AT_ORDER: {
    key: "DELIVERY_COLLECT_AT_ORDER",
    message: "A courier's cash is received when each order is settled, not as a separate collection",
  },
  NO_NETTING: { key: "DELIVERY_NO_NETTING", message: "A payment to a courier can't be netted off cash" },
  SETTLE_TOO_MUCH_CASH: { key: "DELIVERY_SETTLE_TOO_MUCH_CASH", message: "That is more cash than they are holding" },
  SETTLE_TOO_MUCH_FEES: { key: "DELIVERY_SETTLE_TOO_MUCH_FEES", message: "That is more than you owe them" },
};
