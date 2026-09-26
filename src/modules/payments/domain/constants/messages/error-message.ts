export const PAYMENT_ERROR_MESSAGES = {
  SESSION_NOT_FOUND: { key: "PAYMENT_SESSION_NOT_FOUND", message: "This dining session no longer exists" },
  SESSION_ALREADY_ENDED: { key: "PAYMENT_SESSION_ALREADY_ENDED", message: "This dining session has already ended" },
  DISH_NOT_FOUND: { key: "PAYMENT_DISH_NOT_FOUND", message: "One of these dishes is no longer on the menu" },
  DISCOUNT_NOT_ALLOWED: { key: "PAYMENT_DISCOUNT_NOT_ALLOWED", message: "This role isn't allowed to apply a discount" },
  DISCOUNT_EXCEEDS_TOTAL: { key: "PAYMENT_DISCOUNT_EXCEEDS_TOTAL", message: "The discount can't be more than the bill" },
  NOT_FOUND: { key: "PAYMENT_NOT_FOUND", message: "This payment no longer exists" },
};
