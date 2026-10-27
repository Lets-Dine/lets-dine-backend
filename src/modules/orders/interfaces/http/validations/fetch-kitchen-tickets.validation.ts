import { KitchenStation } from "@prisma/client";
import { z } from "zod";

export const fetchKitchenTicketsSchema = z.object({
  station: z.nativeEnum(KitchenStation),
});

export type FetchKitchenTicketsInput = z.infer<typeof fetchKitchenTicketsSchema>;
