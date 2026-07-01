import { z } from "zod";

const referenceSchema = z.object({
  id: z.number().int().positive("Select an option."),
  name: z.string().trim().min(1, "Select an option."),
});

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time.");

const baseUserFormSchema = z
  .object({
    email: z.email("Enter a valid email address."),
    name: z.string().trim().min(1, "Name is required."),
    password: z.string(),
    active: z.boolean(),
    branch: referenceSchema,
    role: referenceSchema,
    restrictLoginHours: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
  })
  .superRefine((values, context) => {
    if (!values.restrictLoginHours) return;
    const start = timeSchema.safeParse(values.startTime);
    const end = timeSchema.safeParse(values.endTime);
    if (!start.success) {
      context.addIssue({ code: "custom", path: ["startTime"], message: "Start time is required." });
    }
    if (!end.success) {
      context.addIssue({ code: "custom", path: ["endTime"], message: "End time is required." });
    }
  });

export function createUserFormSchema(isEditing: boolean) {
  return baseUserFormSchema.superRefine((values, context) => {
    if (!isEditing && values.password.length < 6) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: "Password must contain at least 6 characters.",
      });
    }
  });
}

export type UserFormSchemaValues = z.infer<typeof baseUserFormSchema>;
