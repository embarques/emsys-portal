import { z } from "zod";

export const invoicePolicyFormSchema = z.object({
  title: z.string().trim().min(1, "common.validation.required"),
  body: z.string().trim().min(1, "common.validation.required"),
  sortOrder: z.number().int(),
  active: z.boolean(),
});

export const invoicePolicySchema = invoicePolicyFormSchema.extend({
  id: z.number().int().positive(),
  createdAt: z.string().optional().default(""),
  updatedAt: z.string().optional().default(""),
});
