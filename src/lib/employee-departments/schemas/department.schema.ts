import { z } from "zod";
export const departmentFormSchema = z.object({
  name: z.string().trim().min(1, "Required."),
  active: z.boolean(),
});
export const departmentSchema = departmentFormSchema.extend({
  id: z.number().int().positive(),
  createdAt: z.string().optional().default(""),
  updatedAt: z.string().optional().default(""),
});
