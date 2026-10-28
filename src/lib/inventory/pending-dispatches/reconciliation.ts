import { dateTimeLocalToIso, toDateTimeLocalInput } from "@/lib/inventory/utils/date-time";
import { parseUsdToMinor } from "@/lib/inventory/utils/money";
import { readOutcomeQuantity, type ReconciliationFormValues, type ReconciliationLineFormValues } from "./schemas";
import {
  RECONCILIATION_OUTCOMES,
  type DamageResolution,
  type DispatchReconciliationInput,
  type PendingInventoryDispatch,
} from "./types";

/** One editable block per line that still has supplies in custody. */
export function createReconciliationForm(dispatch: PendingInventoryDispatch, now = toDateTimeLocalInput()): ReconciliationFormValues {
  return {
    occurredAt: now,
    notes: "",
    lines: dispatch.lines
      .filter((line) => line.outstandingQuantity > 0)
      .map((line) => ({
        dispatchLineId: line.id,
        itemName: line.item.name,
        outstanding: line.outstandingQuantity,
        SOLD: "", RETURNED: "", DAMAGED: "", LOST: "", MISSING: "", STOLEN: "",
        revenue: "",
        damageResolution: "",
      })),
  };
}

/** Quantity entered so far for a line; invalid entries count as zero. */
export function accountedQuantity(line: ReconciliationLineFormValues): number {
  return RECONCILIATION_OUTCOMES.reduce((sum, outcome) => sum + (readOutcomeQuantity(line[outcome]) ?? 0), 0);
}

/** Flattens validated form values into the API command; zero quantities are omitted. */
export function buildReconciliationInput(values: ReconciliationFormValues, requestId: string): DispatchReconciliationInput {
  return {
    requestId,
    occurredAt: dateTimeLocalToIso(values.occurredAt) ?? "",
    notes: values.notes.trim(),
    lines: values.lines.flatMap((line) => RECONCILIATION_OUTCOMES.flatMap((outcome) => {
      const quantity = readOutcomeQuantity(line[outcome]) ?? 0;
      if (quantity <= 0) return [];
      return [{
        dispatchLineId: line.dispatchLineId,
        outcome,
        quantity,
        ...(outcome === "SOLD" ? { revenueMinor: parseUsdToMinor(line.revenue) ?? 0 } : {}),
        ...(outcome === "DAMAGED" ? { damageResolution: line.damageResolution as DamageResolution } : {}),
      }];
    })),
  };
}
