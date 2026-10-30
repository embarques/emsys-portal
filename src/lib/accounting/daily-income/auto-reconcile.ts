import { PERMISSIONS } from "@/lib/auth/permissions";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";

/** Same grant that allows reconciling dispatches in Pending Transactions → Inventory. */
export const AUTO_RECONCILE_PERMISSION = PERMISSIONS.inventoryDispatchesReconcile;

/**
 * Dispatched inventory already records its sale on the journal, so the API can reconcile the whole
 * quantity as sold on create instead of leaving it pending in the holder's custody.
 * Contract: `docs/inventory-dispatch-workflows.md` → Auto-reconciliation.
 */
export function isAutoReconcileEligible(
  values: Pick<DailyIncomeJournalValues, "transactionType" | "inventoryDirection" | "inventoryQuantity">,
): boolean {
  return (
    values.transactionType === "INVENTORY" &&
    values.inventoryDirection === "dispatched" &&
    (Number(values.inventoryQuantity) || 0) > 0
  );
}
