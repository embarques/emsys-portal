import { z } from "zod";

export const memoPadFormSchema = z.object({
  name: z.string().trim().min(1, "Memo name is required."),
  content: z.string().max(20_000, "Memo content is too long."),
});

export type MemoPadFormSchema = z.infer<typeof memoPadFormSchema>;
