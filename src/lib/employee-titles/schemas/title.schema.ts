import { z } from "zod";
export const titleFormSchema = z.object({
  name: z.string().trim().min(1, "common.validation.required"),
  active: z.boolean(),
});
export const titleSchema = titleFormSchema.extend({
  id: z.number().int().positive(),
  createdAt: z.string().optional().default(""),
  updatedAt: z.string().optional().default(""),
});
