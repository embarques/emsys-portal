import { z } from "zod";

export const invoicePolicyFormSchema = z.object({
  title: z.string().trim().min(1, "Required."),
  body: z.string().trim().min(1, "Required."),
  sortOrder: z.number().int(),
  active: z.boolean(),
});

export const invoicePolicySchema = invoicePolicyFormSchema.extend({
  id: z.number().int().positive(),
  createdAt: z.string().optional().default(""),
  updatedAt: z.string().optional().default(""),
});
