import { z } from "zod";

export const barcodeStatusFormSchema = z.object({
  name: z.string().trim().min(1, "barcodeStatuses.validation.nameRequired"),
  prevStatus: z.string().trim(),
});

export type BarcodeStatusFormValues = z.infer<typeof barcodeStatusFormSchema>;
