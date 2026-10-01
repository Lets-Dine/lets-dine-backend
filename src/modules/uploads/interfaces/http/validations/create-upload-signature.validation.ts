import { z } from "zod";

/** Where the uploaded image is used — each gets its own Cloudinary folder. */
export const createUploadSignatureSchema = z.object({
  target: z.enum(["dish", "restaurant-cover"]),
});

export type CreateUploadSignatureInput = z.infer<typeof createUploadSignatureSchema>;
