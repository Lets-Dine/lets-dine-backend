import { FeedbackStatus, FeedbackType } from "@prisma/client";
import { z } from "zod";
import { paginationSchema } from "../../../../../common/dto";

export const createFeedbackSchema = z.object({
  type: z.nativeEnum(FeedbackType),
  message: z.string().trim().min(3).max(2000),
  /** Only an image that went through our own signed Cloudinary upload. */
  screenshotUrl: z.string().url().startsWith("https://res.cloudinary.com/").max(500).optional(),
  pagePath: z.string().trim().max(200).default(""),
});

export const fetchFeedbackSchema = z.object({
  ...paginationSchema,
  type: z.nativeEnum(FeedbackType).optional(),
  status: z.nativeEnum(FeedbackStatus).optional(),
});

export const updateFeedbackStatusSchema = z.object({ status: z.nativeEnum(FeedbackStatus) });

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
export type FetchFeedbackQuery = z.infer<typeof fetchFeedbackSchema>;
