import { z } from "zod";

export const saveFonepayConfigSchema = z.object({
  merchantCode: z.string().trim().min(1),
  username: z.string().trim().min(1),
  secretKey: z.string().min(1),
  password: z.string().min(1),
});
