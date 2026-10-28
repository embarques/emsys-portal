import type { InventoryHolderType } from "@/lib/inventory/types/holders";

/** How dispatched supplies left the holder's custody. Contract: `docs/pending-inventory-dispatches.md`. */
export const RECONCILIATION_OUTCOMES = ["SOLD", "RETURNED", "DAMAGED", "LOST", "MISSING", "STOLEN"] as const;
export type ReconciliationOutcome = (typeof RECONCILIATION_OUTCOMES)[number];

export const DAMAGE_RESOLUTIONS = ["QUARANTINE", "WRITE_OFF"] as const;
export type DamageResolution = (typeof DAMAGE_RESOLUTIONS)[number];

export type PendingDispatchLine = {
  id: string;
  item: { id: string; name: string; sku?: string; unitOfMeasure?: string };
  dispatchedQuantity: number;
  reconciledQuantity: number;
  outstandingQuantity: number;
};

/** Posted warehouse dispatch whose supplies are not fully accounted for yet. */
export type PendingInventoryDispatch = {
  id: string;
  dispatchedAt: string;
  ageDays: number;
  holder: { id: string; type: InventoryHolderType | string; displayName: string };
  assigneeEmployee?: { id: string; name: string } | null;
  dailyRoute?: { id: string; name: string } | null;
  dispatchedQuantity: number;
  reconciledQuantity: number;
  outstandingQuantity: number;
  lines: PendingDispatchLine[];
};

export type PendingDispatchFilters = {
  /** Holder id, or "" for all holders. */
  holder: string;
  from: string;
  through: string;
  /** Minimum age in days, or "". */
  age: string;
};

export type DispatchReconciliationLine = {
  dispatchLineId: string;
  itemName?: string;
  outcome: ReconciliationOutcome;
  quantity: number;
  revenueMinor?: number;
  damageResolution?: DamageResolution;
};

export type DispatchReconciliation = {
  id: string;
  recordedAt: string;
  occurredAt?: string;
  performedBy?: { id: string | number; name: string };
  notes?: string;
  lines: DispatchReconciliationLine[];
};

export type DispatchReconciliationInput = {
  requestId: string;
  occurredAt: string;
  notes: string;
  lines: Omit<DispatchReconciliationLine, "itemName">[];
};
