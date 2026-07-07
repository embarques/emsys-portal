import { z } from "zod";

export type UserFormSchemaMessages = {
  selectOption: string;
  validEmail: string;
  nameRequired: string;
  validTime: string;
  startTimeRequired: string;
  endTimeRequired: string;
  passwordMinLength: string;
  confirmPasswordRequired: string;
  passwordsDoNotMatch: string;
};

function createBaseUserFormSchema(messages: UserFormSchemaMessages) {
  const referenceSchema = z.object({
    id: z.number().int().positive(messages.selectOption),
    name: z.string().trim().min(1, messages.selectOption),
  });

  const branchReferenceSchema = z.object({
    id: z.number().int().positive(messages.selectOption),
    code: z.string().trim(),
    name: z.string().trim().min(1, messages.selectOption),
  });

  const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, messages.validTime);

  return z
    .object({
      email: z.email(messages.validEmail),
      name: z.string().trim().min(1, messages.nameRequired),
      password: z.string(),
      confirmPassword: z.string(),
      active: z.boolean(),
      branch: branchReferenceSchema,
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
        context.addIssue({ code: "custom", path: ["startTime"], message: messages.startTimeRequired });
      }
      if (!end.success) {
        context.addIssue({ code: "custom", path: ["endTime"], message: messages.endTimeRequired });
      }
    });
}

export function createUserFormSchema(isEditing: boolean, messages: UserFormSchemaMessages) {
  return createBaseUserFormSchema(messages).superRefine((values, context) => {
    if (!isEditing && values.password.length < 6) {
      context.addIssue({
        code: "custom",
        path: ["password"],
        message: messages.passwordMinLength,
      });
    }
    if (!isEditing && !values.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: messages.confirmPasswordRequired,
      });
    } else if (!isEditing && values.password !== values.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: messages.passwordsDoNotMatch,
      });
    }
  });
}

export type UserFormSchemaValues = z.infer<ReturnType<typeof createBaseUserFormSchema>>;
