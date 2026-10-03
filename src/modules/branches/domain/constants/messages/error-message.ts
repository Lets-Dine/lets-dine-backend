export const BRANCH_ERROR_MESSAGES = {
  NOT_FOUND: { key: "BRANCH_NOT_FOUND", message: "Branch not found" },
  SLUG_ALREADY_EXISTS: { key: "BRANCH_SLUG_ALREADY_EXISTS", message: "A branch with this name already exists" },
  DEFAULT_CANNOT_BE_DISABLED: {
    key: "BRANCH_DEFAULT_CANNOT_BE_DISABLED",
    message: "The default branch cannot be disabled",
  },
  COPY_SAME_BRANCH: { key: "BRANCH_COPY_SAME_BRANCH", message: "Choose a different branch to copy the menu from" },
  MENU_NOT_EMPTY: {
    key: "BRANCH_MENU_NOT_EMPTY",
    message: "This branch already has a menu. Menus can only be copied into an empty branch.",
  },
  INVALID_HOURS: { key: "BRANCH_INVALID_HOURS", message: "Opening time must be before closing time" },
  FORBIDDEN: { key: "BRANCH_FORBIDDEN", message: "You do not have access to this branch" },
};
