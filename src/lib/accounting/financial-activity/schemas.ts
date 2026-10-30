import { z } from "zod";
import { translate } from "@/lib/i18n/catalog";
import type { TranslateFn } from "@/lib/feedback/messages";

const employee = z.object({ id: z.number().int().positive(), name: z.string() });
export function createActivityFormSchema(t: TranslateFn) {
  return z.object({
    type: z.string(),
    amount: z.string(),
    from: z.array(employee),
    to: z.array(employee),
    reference: z.string().max(1000),
    handover: z.string(),
  }).superRefine((values, context) => {
    if (values.type === "REVERSED") {
      if (!values.reference.trim()) context.addIssue({ code: "custom", path: ["reference"], message: t("accounting.financialActivity.validation.reasonRequired") });
    } else if (!Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0) {
      context.addIssue({ code: "custom", path: ["amount"], message: t("accounting.financialActivity.validation.amountPositive") });
    }
    if (values.type === "HANDED_OVER" && (!values.from.length || !values.to.length || values.from[0].id === values.to[0].id)) {
      context.addIssue({ code: "custom", path: ["to"], message: t("accounting.financialActivity.validation.differentEmployees") });
    }
  });
}
export const activityFormSchema = createActivityFormSchema((key, params) => translate("en", key, params));
export type ActivityFormValues = z.infer<typeof activityFormSchema>;
