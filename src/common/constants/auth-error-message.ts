export const AUTH_ERROR_MESSAGES = {
  MISSING_TOKEN: { key: "AUTH_MISSING_TOKEN", message: "Authentication token is missing" },
  INVALID_TOKEN: { key: "AUTH_INVALID_TOKEN", message: "Authentication token is invalid or has expired" },
  FORBIDDEN: { key: "AUTH_FORBIDDEN", message: "You do not have permission to perform this action" },
  INVALID_CREDENTIALS: { key: "AUTH_INVALID_CREDENTIALS", message: "Email or PIN is incorrect" },
  NO_BRANCH_ACCESS: { key: "AUTH_NO_BRANCH_ACCESS", message: "You are not assigned to any active branch" },
  APPROVAL_PIN_SAME_AS_SIGN_IN: { key: "AUTH_APPROVAL_PIN_SAME", message: "The approval PIN has to be different from your sign-in PIN" },
  APPROVAL_PIN_NOT_FOR_ROLE: {
    key: "AUTH_APPROVAL_PIN_NOT_FOR_ROLE",
    message: "Only a manager or owner approves things, so only they have an approval PIN",
  },
  PIN_IS_APPROVAL_PIN: { key: "AUTH_PIN_IS_APPROVAL_PIN", message: "Choose a sign-in PIN different from your approval PIN" },
  WRONG_CURRENT_PIN: { key: "AUTH_WRONG_CURRENT_PIN", message: "Your current PIN is incorrect" },
  PHONE_TAKEN: { key: "AUTH_PHONE_TAKEN", message: "That phone number belongs to another account" },
  ACCOUNT_INACTIVE: { key: "AUTH_ACCOUNT_INACTIVE", message: "This account is no longer active" },
  SOLE_OWNER_CANNOT_DELETE: {
    key: "AUTH_SOLE_OWNER_CANNOT_DELETE",
    message: "You are the only owner of a restaurant. Make another owner before deleting your account",
  },
};
