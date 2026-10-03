import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

/** A range may close at midnight, written "24:00"; one that runs past it is two entries. */
const closingTime = z.union([time, z.literal("24:00")]);

const hoursEntry = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opensAt: time,
  closesAt: closingTime,
  isClosed: z.boolean().default(false),
});

export const setBranchHoursSchema = z.object({
  hours: z.array(hoursEntry).max(28),
});

export type SetBranchHoursInput = z.infer<typeof setBranchHoursSchema>;
