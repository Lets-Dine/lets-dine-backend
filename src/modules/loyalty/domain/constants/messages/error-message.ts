export const LOYALTY_ERROR_MESSAGES = {
  CUSTOMER_NOT_FOUND: { key: "LOYALTY_CUSTOMER_NOT_FOUND", message: "This customer is not one of your regulars" },
  ORDER_NOT_FOUND: { key: "LOYALTY_ORDER_NOT_FOUND", message: "This order could not be found" },
  REDEEM_NEEDS_CUSTOMER: { key: "LOYALTY_REDEEM_NEEDS_CUSTOMER", message: "These orders have no customer to spend points for" },
  REDEEM_PROGRAM_OFF: { key: "LOYALTY_REDEEM_PROGRAM_OFF", message: "Loyalty points are not switched on for this restaurant" },
  REDEEM_OVER_BALANCE: { key: "LOYALTY_REDEEM_OVER_BALANCE", message: "The customer does not have that many points" },
  REDEEM_OVER_CAP: { key: "LOYALTY_REDEEM_OVER_CAP", message: "Points can only pay for part of a bill. Use fewer points." },
  INSUFFICIENT_POINTS: { key: "LOYALTY_INSUFFICIENT_POINTS", message: "That would take the customer's points below zero" },
};
