import { z } from "zod";

import { dateTimeLocalToIso } from "@/lib/inventory/utils/date-time";
import { parseUsdToMinor, parseWholeQuantity } from "@/lib/inventory/utils/money";
import { DAMAGE_RESOLUTIONS, RECONCILIATION_OUTCOMES } from "./types";

/** Issue messages are i18n keys under `accounting.pendingInventory.errors`. */
const ERRORS = "accounting.pendingInventory.errors";

const lineSchema = z.object({
  dispatchLineId: z.string().min(1),
  itemName: z.string(),
  outstanding: z.number().int().nonnegative(),
  SOLD: z.string(),
  RETURNED: z.string(),
  DAMAGED: z.string(),
  LOST: z.string(),
  MISSING: z.string(),
  STOLEN: z.string(),
  revenue: z.string(),
  damageResolution: z.string(),
});

export function readOutcomeQuantity(value: string): number | null {
  return value.trim() === "" ? 0 : parseWholeQuantity(value, { allowZero: true });
}

export const reconciliationFormSchema = z.object({
  occurredAt: z.string(),
  notes: z.string().max(1000),
  lines: z.array(lineSchema),
}).superRefine((values, context) => {
  if (!dateTimeLocalToIso(values.occurredAt)) {
    context.addIssue({ code: "custom", path: ["occurredAt"], message: `${ERRORS}.occurredAt` });
  }
  let total = 0;
  values.lines.forEach((line, index) => {
    let accounted = 0;
    for (const outcome of RECONCILIATION_OUTCOMES) {
      const quantity = readOutcomeQuantity(line[outcome]);
      if (quantity === null) {
        context.addIssue({ code: "custom", path: ["lines", index, outcome], message: `${ERRORS}.quantity` });
      } else {
        accounted += quantity;
      }
    }
    total += accounted;
    if (accounted > line.outstanding) {
      context.addIssue({ code: "custom", path: ["lines", index, "outstanding"], message: `${ERRORS}.exceeds` });
    }
    if ((readOutcomeQuantity(line.SOLD) ?? 0) > 0 && parseUsdToMinor(line.revenue) === null) {
      context.addIssue({ code: "custom", path: ["lines", index, "revenue"], message: `${ERRORS}.revenue` });
    }
    if ((readOutcomeQuantity(line.DAMAGED) ?? 0) > 0 && !(DAMAGE_RESOLUTIONS as readonly string[]).includes(line.damageResolution)) {
      context.addIssue({ code: "custom", path: ["lines", index, "damageResolution"], message: `${ERRORS}.resolution` });
    }
  });
  if (total === 0) {
    context.addIssue({ code: "custom", path: ["lines"], message: `${ERRORS}.nothing` });
  }
});

export type ReconciliationFormValues = z.infer<typeof reconciliationFormSchema>;
export type ReconciliationLineFormValues = ReconciliationFormValues["lines"][number];
