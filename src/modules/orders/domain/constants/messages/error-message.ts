export const ORDER_ERROR_MESSAGES = {
  NOT_FOUND: { key: "ORDER_NOT_FOUND", message: "Order not found" },
  EMPTY_CART: { key: "ORDER_EMPTY_CART", message: "Add something to the cart before ordering" },
  DISH_NOT_FOUND: { key: "ORDER_DISH_NOT_FOUND", message: "One of these dishes is no longer on the menu" },
  DISH_UNAVAILABLE: { key: "ORDER_DISH_UNAVAILABLE", message: "One of these dishes just became unavailable" },
  INVALID_TRANSITION: { key: "ORDER_INVALID_TRANSITION", message: "This order cannot move to that status" },
  ALREADY_CANCELLED: { key: "ORDER_ALREADY_CANCELLED", message: "This order has already been cancelled" },
  NOT_CANCELLABLE: { key: "ORDER_NOT_CANCELLABLE", message: "This order has gone too far to be cancelled" },
};
