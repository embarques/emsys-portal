import { z } from "zod";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function createChangePasswordSchema(t: TranslateFn) {
  return z
    .object({
      password: z.string().min(6, t("settings.password.validation.passwordMin")),
      confirmPassword: z.string().min(1, t("settings.password.validation.confirmRequired")),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: t("settings.password.validation.passwordsMismatch"),
      path: ["confirmPassword"],
    });
}

export type ChangePasswordValues = z.infer<ReturnType<typeof createChangePasswordSchema>>;
