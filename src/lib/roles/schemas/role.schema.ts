import { z } from "zod";

export const roleFormSchema = z.object({
  roleId: z.string(),
  name: z.string().trim().min(1, "Role name is required."),
  active: z.boolean(),
  permissions: z
    .array(
      z.object({
        id: z.string().min(1),
        value: z.string().min(1),
      })
    )
    .min(1, "Select at least one permission."),
  createdBy: z.string(),
});
