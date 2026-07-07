import { z } from "zod";

type RoleFormSchemaMessages = {
  nameRequired: string;
  permissionsRequired: string;
};

export function createRoleFormSchema(messages: RoleFormSchemaMessages) {
  return z.object({
    roleId: z.string(),
    name: z.string().trim().min(1, messages.nameRequired),
    active: z.boolean(),
    permissions: z
      .array(
        z.object({
          id: z.string().min(1),
          value: z.string().min(1),
        }),
      )
      .min(1, messages.permissionsRequired),
    createdBy: z.string(),
  });
}

export const roleFormSchema = createRoleFormSchema({
  nameRequired: "Role name is required.",
  permissionsRequired: "Select at least one permission.",
});
