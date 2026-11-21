import { z } from "zod";

export const journalCorrectionReasonSchema = z.object({
  reason: z.string().trim().min(1, "accounting.journalLifecycle.reasonRequired").max(1000, "accounting.journalLifecycle.reasonTooLong"),
});

export function journalLifecycleSchema(noteOnly: boolean) {
  return z.object({
    reason: noteOnly ? z.string() : journalCorrectionReasonSchema.shape.reason,
    description: z.string().max(2000, "accounting.journalLifecycle.descriptionTooLong"),
  });
}
