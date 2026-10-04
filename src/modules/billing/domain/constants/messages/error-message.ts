export const BILLING_ERROR_MESSAGES = {
  PLAN_LIMIT_REACHED: {
    key: "PLAN_LIMIT_REACHED",
    message: "Your plan's limit has been reached. Upgrade your plan to add more.",
  },
  FEATURE_LOCKED: { key: "FEATURE_LOCKED", message: "This feature is not included in your current plan" },
  SUBSCRIPTION_RESTRICTED: {
    key: "SUBSCRIPTION_RESTRICTED",
    message: "Your subscription needs attention. Settle the outstanding invoice to make changes.",
  },
  SUBSCRIPTION_SUSPENDED: {
    key: "SUBSCRIPTION_SUSPENDED",
    message: "This restaurant's subscription is suspended. The owner needs to settle the outstanding invoice to restore access.",
  },
  INVALID_PLAN_CONFIG: { key: "BILLING_INVALID_PLAN_CONFIG", message: "The plan's limits or features are misconfigured" },
  SUBSCRIPTION_NOT_FOUND: { key: "SUBSCRIPTION_NOT_FOUND", message: "Subscription not found" },
  PLAN_NOT_FOUND: { key: "PLAN_NOT_FOUND", message: "Plan not found" },
  PLAN_NOT_AVAILABLE: { key: "PLAN_NOT_AVAILABLE", message: "This plan is not available for self-service. Contact us to switch to it." },
  ALREADY_ON_PLAN: { key: "ALREADY_ON_PLAN", message: "You are already on this plan" },
  EXTRAS_NOT_AVAILABLE: {
    key: "BILLING_EXTRAS_NOT_AVAILABLE",
    message: "This plan has no price for extra branches or seats, so they cannot be added to it",
  },
  INVOICE_NOT_FOUND: { key: "INVOICE_NOT_FOUND", message: "Invoice not found" },
  INVOICE_NOT_OPEN: { key: "INVOICE_NOT_OPEN", message: "Only an open invoice can be marked as paid" },
};
