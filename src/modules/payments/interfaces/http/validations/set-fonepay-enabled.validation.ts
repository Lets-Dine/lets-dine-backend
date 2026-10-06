import { z } from "zod";

export const setFonepayEnabledSchema = z.object({ enabled: z.boolean() });
