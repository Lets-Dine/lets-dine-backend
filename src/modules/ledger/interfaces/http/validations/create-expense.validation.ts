import { ExpenseKind, PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const createExpenseSchema = z.object({
  kind: z.nativeEnum(ExpenseKind).default(ExpenseKind.EXPENSE),
  amount: z.number().int().min(1),
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  category: z.string().trim().min(1).max(60),
  note: z.string().trim().max(300).default(""),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
