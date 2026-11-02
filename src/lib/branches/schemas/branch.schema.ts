import { z } from "zod";
import type { BranchFormValues } from "@/lib/branches/types";
export const branchFormSchema = z.custom<BranchFormValues>().superRefine((values, context) => {
  if (!values.name.trim()) context.addIssue({ code: "custom", path: ["name"], message: "branches.form.validation.nameRequired" });
  for (const [key, value] of Object.entries(values.settings)) {
    if (typeof value === "number" && (!Number.isInteger(value) || value < 0)) {
      context.addIssue({ code: "custom", path: ["settings", key], message: "branches.form.validation.nonNegativeWholeNumber" });
    }
  }
});
