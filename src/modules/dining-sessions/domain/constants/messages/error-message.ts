export const DINING_SESSION_ERROR_MESSAGES = {
  NOT_FOUND: { key: "DINING_SESSION_NOT_FOUND", message: "This dining session no longer exists" },
  EXPIRED: { key: "DINING_SESSION_EXPIRED", message: "This dining session has ended — scan the table code again" },
  REQUIRED: { key: "DINING_SESSION_REQUIRED", message: "Scan the table code to continue" },
  TABLE_NOT_FOUND: { key: "DINING_SESSION_TABLE_NOT_FOUND", message: "This table code is not valid" },
  TABLE_OCCUPIED: {
    key: "DINING_SESSION_TABLE_OCCUPIED",
    message: "This table already has an active visit. Ask someone at the table for the session ID to join.",
  },
  JOIN_MISMATCH: {
    key: "DINING_SESSION_JOIN_MISMATCH",
    message: "That session ID does not match this table's active visit.",
  },
  NO_ACTIVE_SESSION: { key: "DINING_SESSION_NO_ACTIVE_SESSION", message: "This table has no active visit to end" },
};
