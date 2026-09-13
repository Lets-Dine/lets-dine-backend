export const USER_ERROR_MESSAGES = {
  NOT_FOUND: { key: "USER_NOT_FOUND", message: "User not found" },
  EMAIL_ALREADY_EXISTS: { key: "USER_EMAIL_ALREADY_EXISTS", message: "A user with this email already exists" },
};

export const STAFF_MEMBER_ERROR_MESSAGES = {
  NOT_FOUND: { key: "STAFF_MEMBER_NOT_FOUND", message: "Staff member not found" },
  ALREADY_EXISTS: { key: "STAFF_MEMBER_ALREADY_EXISTS", message: "This person is already on the team" },
  CANNOT_EDIT_SELF: { key: "STAFF_MEMBER_CANNOT_EDIT_SELF", message: "You cannot change your own role or access" },
  LAST_OWNER: { key: "STAFF_MEMBER_LAST_OWNER", message: "A restaurant must keep at least one active owner" },
};
