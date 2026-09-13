export const DISH_REVIEW_ERROR_MESSAGES = {
  NOT_FOUND: { key: "DISH_REVIEW_NOT_FOUND", message: "Review not found" },
  ORDER_NOT_FOUND: { key: "DISH_REVIEW_ORDER_NOT_FOUND", message: "That order is not yours to review" },
  ORDER_NOT_COMPLETED: {
    key: "DISH_REVIEW_ORDER_NOT_COMPLETED",
    message: "You can rate these dishes once the order is complete",
  },
  DISH_NOT_IN_ORDER: { key: "DISH_REVIEW_DISH_NOT_IN_ORDER", message: "You did not order this dish" },
  ALREADY_REVIEWED: { key: "DISH_REVIEW_ALREADY_REVIEWED", message: "You have already rated this dish on this order" },
  UNKNOWN_TAG: { key: "DISH_REVIEW_UNKNOWN_TAG", message: "One of these tags is not a valid review tag" },
};
