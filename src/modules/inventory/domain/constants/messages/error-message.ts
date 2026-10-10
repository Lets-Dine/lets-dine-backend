export const INVENTORY_ERROR_MESSAGES = {
  INGREDIENT_NOT_FOUND: { key: "INVENTORY_INGREDIENT_NOT_FOUND", message: "This ingredient no longer exists" },
  INGREDIENT_EXISTS: { key: "INVENTORY_INGREDIENT_EXISTS", message: "An ingredient with this name already exists" },
  BRANCH_NOT_FOUND: { key: "INVENTORY_BRANCH_NOT_FOUND", message: "That branch doesn't exist" },
  BRANCH_FORBIDDEN: { key: "INVENTORY_BRANCH_FORBIDDEN", message: "You don't have access to that branch" },
  TRANSFER_SAME_BRANCH: { key: "INVENTORY_TRANSFER_SAME_BRANCH", message: "Choose a different branch to send it to" },
  INSUFFICIENT_STOCK: { key: "INVENTORY_INSUFFICIENT_STOCK", message: "There isn't that much in stock to send" },
  USE_EXCEEDS_STOCK: { key: "INVENTORY_USE_EXCEEDS_STOCK", message: "There isn't that much in stock to use" },
  UNIT_MISMATCH: { key: "INVENTORY_UNIT_MISMATCH", message: "The other branch counts this ingredient in a different unit" },
  DISH_NOT_FOUND: { key: "INVENTORY_DISH_NOT_FOUND", message: "This dish no longer exists" },
};
