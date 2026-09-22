export const ORDER_ERROR_MESSAGES = {
  NOT_FOUND: { key: "ORDER_NOT_FOUND", message: "Order not found" },
  EMPTY_CART: { key: "ORDER_EMPTY_CART", message: "Add something to the cart before ordering" },
  DISH_NOT_FOUND: { key: "ORDER_DISH_NOT_FOUND", message: "One of these dishes is no longer on the menu" },
  DISH_UNAVAILABLE: { key: "ORDER_DISH_UNAVAILABLE", message: "One of these dishes just became unavailable" },
  INVALID_TRANSITION: { key: "ORDER_INVALID_TRANSITION", message: "This order cannot move to that status" },
  ALREADY_CANCELLED: { key: "ORDER_ALREADY_CANCELLED", message: "This order has already been cancelled" },
  NOT_CANCELLABLE: { key: "ORDER_NOT_CANCELLABLE", message: "This order has gone too far to be cancelled" },
  TABLE_NOT_FOUND: { key: "ORDER_TABLE_NOT_FOUND", message: "That table no longer exists" },
  NO_ORDER_FOR_TABLE: { key: "ORDER_NO_ORDER_FOR_TABLE", message: "This table has no order to add to" },
  ITEM_NOT_FOUND: { key: "ORDER_ITEM_NOT_FOUND", message: "That item is no longer on the bill" },
  NO_OPEN_ORDERS: { key: "ORDER_NO_OPEN_ORDERS", message: "This table has no open orders to settle" },
  /** §20 — once an order is accepted, its status only ever moves by advancing items. */
  STATUS_FOLLOWS_ITEMS: {
    key: "ORDER_STATUS_FOLLOWS_ITEMS",
    message: "Order status now follows its items — advance items individually",
  },
  ITEM_INVALID_TRANSITION: { key: "ORDER_ITEM_INVALID_TRANSITION", message: "That item cannot move to that status" },
  ITEM_NOT_CANCELLABLE: { key: "ORDER_ITEM_NOT_CANCELLABLE", message: "The kitchen has already started this item" },
};
