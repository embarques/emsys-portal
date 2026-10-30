import type { InventoryConfirmationState } from "@/lib/inventory/types/common";
import type { InventoryHolderType } from "@/lib/inventory/types/holders";

/** How dispatched supplies left the holder's custody. Contract: `docs/inventory-dispatch-workflows.md`. */
export const RECONCILIATION_OUTCOMES = ["SOLD", "RETURNED", "DAMAGED", "LOST", "MISSING", "STOLEN"] as const;
export type ReconciliationOutcome = (typeof RECONCILIATION_OUTCOMES)[number];

/** Outcomes that write supplies off; a reconciliation with any of them needs a description. */
export const LOSS_OUTCOMES = ["DAMAGED", "LOST", "MISSING", "STOLEN"] as const satisfies readonly ReconciliationOutcome[];

export const DAMAGE_RESOLUTIONS = ["QUARANTINE", "WRITE_OFF"] as const;
export type DamageResolution = (typeof DAMAGE_RESOLUTIONS)[number];

export const RECONCILIATION_STATUSES = ["PENDING_CONFIRMATION", "CONFIRMED", "REJECTED"] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export type PendingDispatchLine = {
  id: string;
  item: { id: string; name: string; sku?: string; unitOfMeasure?: string };
  dispatchedQuantity: number;
  reconciledQuantity: number;
  /** Submitted in reconciliations that are not confirmed yet. */
  awaitingConfirmationQuantity: number;
  outstandingQuantity: number;
};

export type IncomeRecipient = { id: string; name: string; role: "SUPERVISOR" | "RESPONSIBLE" | "HOLDER" | string };

/** Posted warehouse dispatch whose supplies are not fully accounted for yet. */
export type PendingInventoryDispatch = {
  id: string;
  dispatchedAt: string;
  ageDays: number;
  holder: { id: string; type: InventoryHolderType | string; displayName: string };
  assigneeEmployee?: { id: string; name: string } | null;
  dailyRoute?: { id: string; name: string; supervisor?: { id: string; name: string } | null } | null;
  /** Employees who may receive the sale income, supervisor first. */
  incomeRecipients: IncomeRecipient[];
  /** Sales were already posted by Daily Income at dispatch time; no revenue or payments on reconciliation. */
  salesRecordedAtDispatch: boolean;
  dispatchedQuantity: number;
  reconciledQuantity: number;
  awaitingConfirmationQuantity: number;
  outstandingQuantity: number;
  pendingReconciliationCount: number;
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

/** One payment collected for sold supplies. Check numbers stay strings (leading zeros). */
export type ReconciliationPayment = {
  paymentMethod: { id: number; name: string };
  amountMinor: number;
  paymentAccount?: { id: number; name: string } | null;
  /** Check number. */
  paymentReference?: string;
  /** Zelle / deposit / card confirmation. */
  externalReferenceNumber?: string;
};

export type DispatchReconciliation = InventoryConfirmationState & {
  id: string;
  status: ReconciliationStatus;
  version: number | null;
  recordedAt: string;
  occurredAt?: string;
  performedBy?: { id: string | number; name: string };
  notes?: string;
  incomeEmployee?: { id: string; name: string } | null;
  lines: DispatchReconciliationLine[];
  payments: ReconciliationPayment[];
  /** Unpaid sale revenue; collected later through a collection obligation. */
  creditMinor: number;
  collectionObligationId?: string | null;
};

export type ReconciliationPaymentInput = {
  paymentMethod: { id: number; name: string };
  amountMinor: number;
  paymentAccountId?: number;
  /** Check number; also dual-sent as legacy `checkNumber`. */
  paymentReference?: string;
  checkNumber?: string;
  externalReferenceNumber?: string;
};

export type DispatchReconciliationInput = {
  requestId: string;
  occurredAt: string;
  notes: string;
  incomeEmployeeId?: string;
  lines: Omit<DispatchReconciliationLine, "itemName">[];
  payments: ReconciliationPaymentInput[];
};
