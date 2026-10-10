export const PAYMENT_ERROR_MESSAGES = {
  SESSION_NOT_FOUND: { key: "PAYMENT_SESSION_NOT_FOUND", message: "This dining session no longer exists" },
  SESSION_ALREADY_ENDED: { key: "PAYMENT_SESSION_ALREADY_ENDED", message: "This dining session has already ended" },
  DISH_NOT_FOUND: { key: "PAYMENT_DISH_NOT_FOUND", message: "One of these dishes is no longer on the menu" },
  VARIANT_NOT_FOUND: { key: "PAYMENT_VARIANT_NOT_FOUND", message: "One of these dishes' sizes is no longer on the menu" },
  ADD_ON_NOT_FOUND: { key: "PAYMENT_ADD_ON_NOT_FOUND", message: "One of these extras is no longer on the menu" },
  DISCOUNT_NOT_ALLOWED: { key: "PAYMENT_DISCOUNT_NOT_ALLOWED", message: "This role isn't allowed to apply a discount" },
  DISCOUNT_EXCEEDS_TOTAL: { key: "PAYMENT_DISCOUNT_EXCEEDS_TOTAL", message: "The discount can't be more than the bill" },
  NOT_FOUND: { key: "PAYMENT_NOT_FOUND", message: "This payment no longer exists" },
  ORDER_NOT_FOUND: { key: "PAYMENT_ORDER_NOT_FOUND", message: "That order is no longer on this session" },
  ORDER_NOT_FLOOR: { key: "PAYMENT_ORDER_NOT_FLOOR", message: "Only a floor order can be paid on its own like this" },
  ORDER_ALREADY_PAID: { key: "PAYMENT_ORDER_ALREADY_PAID", message: "That order has already been paid" },
};
