import { z } from "zod";

export const CHANGE_RESOURCES = ["pickup", "invoice", "journal", "labels", "inventory"] as const;

export const changeRequestFormSchema = z.object({
  resourceType: z.enum(CHANGE_RESOURCES),
  resourceId: z.string().trim().min(1),
  action: z.enum(["UPDATE", "VOID"]),
  reason: z.string().trim().min(1).max(1000),
  text: z.string(),
  amount: z.string(),
}).superRefine((values, context) => {
  if (values.action !== "UPDATE") return;
  if (!values.text.trim()) {
    context.addIssue({ code: "custom", path: ["text"], message: "Required" });
  }
  if (values.resourceType === "journal" && values.amount.trim() &&
      (!Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0)) {
    context.addIssue({ code: "custom", path: ["amount"], message: "Enter a positive amount" });
  }
});

export const changeReviewSchema = z.object({ reason: z.string().trim().max(1000) });
export type ChangeRequestFormValues = z.infer<typeof changeRequestFormSchema>;
