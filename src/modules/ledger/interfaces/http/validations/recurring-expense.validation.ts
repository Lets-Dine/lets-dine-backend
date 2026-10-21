import { PaymentMethod, RecurrenceFrequency } from "@prisma/client";
import { z } from "zod";

/** A real calendar day: "2026-02-30" has the right shape and is not one. */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-05")
  .refine(v => new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v, "That day does not exist");

/** The two names the stock and refund flows write; the profit and loss reads them as purchases and refunds, not running costs. */
const reservedCategory = (v: string) => !["stock", "refund"].includes(v.trim().toLowerCase());

const fields = {
  category: z.string().trim().min(1).max(60).refine(reservedCategory, "Stock and refunds are tracked from inventory and sales — pick another name"),
  amount: z.number().int().min(1).max(2_000_000_000),
  method: z.nativeEnum(PaymentMethod),
  note: z.string().trim().max(300),
  frequency: z.nativeEnum(RecurrenceFrequency),
  /** MONTHLY: 1–31. WEEKLY: 0 Sunday – 6 Saturday. */
  dueDay: z.number().int().min(0).max(31),
  startsOn: day,
};

const dayFitsFrequency = (v: { frequency?: RecurrenceFrequency; dueDay?: number }) =>
  v.frequency === undefined || v.dueDay === undefined || (v.frequency === RecurrenceFrequency.WEEKLY ? v.dueDay <= 6 : v.dueDay >= 1);
const dayMessage = { message: "A monthly cost is due on day 1–31, a weekly one on a weekday 0–6", path: ["dueDay"] };

export const createRecurringExpenseSchema = z
  .object({ ...fields, method: fields.method.default(PaymentMethod.CASH), note: fields.note.default(""), startsOn: day.optional() })
  .refine(dayFitsFrequency, dayMessage);

export const updateRecurringExpenseSchema = z
  .object({ ...fields, isActive: z.boolean() })
  .omit({ startsOn: true })
  .partial()
  .refine(dayFitsFrequency, dayMessage);

/** `skip-all` clears every date waiting up to today — a long-forgotten cost is not hundreds of taps. */
export const settleRecurringExpenseSchema = z.object({ dueOn: day, action: z.enum(["post", "skip", "skip-all"]) });

export type CreateRecurringExpenseInput = z.infer<typeof createRecurringExpenseSchema>;
export type UpdateRecurringExpenseInput = z.infer<typeof updateRecurringExpenseSchema>;
export type SettleRecurringExpenseInput = z.infer<typeof settleRecurringExpenseSchema>;
