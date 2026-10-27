import { z } from "zod";

const employee = z.object({ id: z.number().int().positive(), name: z.string() });
export const activityFormSchema = z.object({
  type: z.string(),
  amount: z.string(),
  from: z.array(employee),
  to: z.array(employee),
  reference: z.string().max(1000),
  handover: z.string(),
}).superRefine((values, context) => {
  if (values.type === "REVERSED") {
    if (!values.reference.trim()) context.addIssue({ code: "custom", path: ["reference"], message: "A reason is required." });
  } else if (!Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0) {
    context.addIssue({ code: "custom", path: ["amount"], message: "Enter an amount greater than zero." });
  }
  if (values.type === "HANDED_OVER" && (!values.from.length || !values.to.length || values.from[0].id === values.to[0].id)) {
    context.addIssue({ code: "custom", path: ["to"], message: "Select different sending and receiving employees." });
  }
});
export type ActivityFormValues = z.infer<typeof activityFormSchema>;
