export const LEDGER_ERROR_MESSAGES = {
  EXPENSE_NOT_FOUND: { key: "LEDGER_EXPENSE_NOT_FOUND", message: "This expense no longer exists" },
  EXPENSE_ALREADY_CLOSED: { key: "LEDGER_EXPENSE_ALREADY_CLOSED", message: "This expense belongs to a closed period and can't be removed" },
  EXPENSE_FROM_SUPPLIER_PAYMENT: {
    key: "LEDGER_EXPENSE_FROM_SUPPLIER_PAYMENT",
    message: "This entry is a payment to a supplier and can't be removed from the cash book",
  },
  EXPENSE_FROM_DELIVERY: {
    key: "LEDGER_EXPENSE_FROM_DELIVERY",
    message: "This entry was posted by a delivery settlement and can't be removed from the cash book",
  },
  ALREADY_CLOSED_TODAY: {
    key: "LEDGER_ALREADY_CLOSED_TODAY",
    message: "Today's books are already closed. Reopen the last close to add to it.",
  },
  NOTHING_TO_REOPEN: { key: "LEDGER_NOTHING_TO_REOPEN", message: "There is no closed period to reopen" },
};
