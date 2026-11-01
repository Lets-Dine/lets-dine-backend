export const BILLING_ERROR_MESSAGES = {
  PLAN_LIMIT_REACHED: {
    key: "PLAN_LIMIT_REACHED",
    message: "Your plan's limit has been reached. Upgrade your plan to add more.",
  },
  TRIAL_PLAN_LOCKED: {
    key: "TRIAL_PLAN_LOCKED",
    message: "You can change your plan once your trial ends. Until then you have Growth's full features.",
  },
  DOWNGRADE_BLOCKED: { key: "DOWNGRADE_BLOCKED", message: "This plan can't hold your current branches and staff" },
  FEATURE_LOCKED: { key: "FEATURE_LOCKED", message: "This feature is not included in your current plan" },
  SUBSCRIPTION_RESTRICTED: {
    key: "SUBSCRIPTION_RESTRICTED",
    message: "Your subscription needs attention. Renew the plan to make changes.",
  },
  SUBSCRIPTION_SUSPENDED: {
    key: "SUBSCRIPTION_SUSPENDED",
    message: "This restaurant's subscription is suspended. The owner needs to renew the plan to restore access.",
  },
  INVALID_PLAN_CONFIG: { key: "BILLING_INVALID_PLAN_CONFIG", message: "The plan's limits or features are misconfigured" },
  SUBSCRIPTION_NOT_FOUND: { key: "SUBSCRIPTION_NOT_FOUND", message: "Subscription not found" },
  NOTHING_TO_CHANGE: { key: "NOTHING_TO_CHANGE", message: "Nothing to change" },
  TRIAL_DATE_NOT_ON_TRIAL: { key: "TRIAL_DATE_NOT_ON_TRIAL", message: "Only a subscription on trial has a trial end date" },
  PERIOD_END_BEFORE_START: { key: "PERIOD_END_BEFORE_START", message: "The period must end after it starts" },
  BOTH_DATES: { key: "BOTH_DATES", message: "Send either the trial end or the period end, not both" },
  DATE_NOT_FUTURE: { key: "DATE_NOT_FUTURE", message: "The new date must be in the future" },
  PERIOD_END_ON_TRIAL: { key: "PERIOD_END_ON_TRIAL", message: "A trial's end is set with the trial end date, not the period end" },
  PERIOD_END_WHEN_UNPAID: { key: "PERIOD_END_WHEN_UNPAID", message: "This subscription is past due, so its period end can't be edited" },
  CANCEL_AT_END_NOT_AVAILABLE: {
    key: "CANCEL_AT_END_NOT_AVAILABLE",
    message: "Only a trial or active subscription can be cancelled at period end. Cancel it now instead.",
  },
  ALREADY_CANCELLED: { key: "ALREADY_CANCELLED", message: "This subscription is already cancelled" },
  NOT_CANCELLED: { key: "NOT_CANCELLED", message: "This subscription is not cancelled or scheduled to cancel" },
  PLAN_NOT_FOUND: { key: "PLAN_NOT_FOUND", message: "Plan not found" },
  PLAN_NOT_AVAILABLE: { key: "PLAN_NOT_AVAILABLE", message: "This plan is not available for self-service. Contact us to switch to it." },
  ALREADY_ON_PLAN: { key: "ALREADY_ON_PLAN", message: "You are already on this plan" },
  EXTRAS_NOT_AVAILABLE: {
    key: "BILLING_EXTRAS_NOT_AVAILABLE",
    message: "This plan has no price for extra branches or seats, so they cannot be added to it",
  },
  INVOICE_NOT_FOUND: { key: "INVOICE_NOT_FOUND", message: "Invoice not found" },
  INVOICE_NOT_OPEN: { key: "INVOICE_NOT_OPEN", message: "Only an open invoice can be marked as paid" },
  INVOICE_ALREADY_OPEN: { key: "INVOICE_ALREADY_OPEN", message: "This restaurant already has an open invoice" },
  SUBSCRIPTION_CANCELLED: {
    key: "SUBSCRIPTION_CANCELLED",
    message: "This restaurant's subscription is cancelled, so it can't be renewed",
  },
  RENEWAL_NOT_DUE: {
    key: "RENEWAL_NOT_DUE",
    message: "This plan is not due for renewal yet",
  },
  ESEWA_NOT_CONFIGURED: {
    key: "ESEWA_NOT_CONFIGURED",
    message: "Online payment isn't available yet. Contact us and we will record the renewal.",
  },
  ESEWA_NPR_ONLY: { key: "ESEWA_NPR_ONLY", message: "eSewa can only take payment in NPR" },
  ESEWA_PAYMENT_INVALID: {
    key: "ESEWA_PAYMENT_INVALID",
    message: "We couldn't confirm this eSewa payment. If you were charged, contact us.",
  },
  ESEWA_UNREACHABLE: { key: "ESEWA_UNREACHABLE", message: "Couldn't reach eSewa to confirm the payment. Reload to try again." },
};
