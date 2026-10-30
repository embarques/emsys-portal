export const INVENTORY_DOCUMENT_STATUSES = ["DRAFT", "PENDING_CONFIRMATION", "POSTED", "CANCELLED"] as const;
export type InventoryDocumentStatus = (typeof INVENTORY_DOCUMENT_STATUSES)[number];

/** Who confirms a physical handoff. Contract: `docs/inventory-dispatch-workflows.md`. */
export const INVENTORY_CONFIRMATION_PARTIES = ["WAREHOUSE", "CUSTODIAN"] as const;
export type InventoryConfirmationParty = (typeof INVENTORY_CONFIRMATION_PARTIES)[number];

export type InventoryConfirmationAction = "CONFIRM_WAREHOUSE" | "CONFIRM_CUSTODIAN" | "REJECT";

export type InventoryConfirmation = {
  confirmedAt: string;
  confirmedBy: string;
  notes: string;
};

export type InventoryRejection = {
  rejectedAt: string;
  rejectedBy: string;
  party: InventoryConfirmationParty | null;
  reason: string;
};

/** Server-owned confirmation state on receipts, dispatches and reconciliations. */
export type InventoryConfirmationState = {
  confirmations: { warehouse: InventoryConfirmation | null; custodian: InventoryConfirmation | null };
  rejection: InventoryRejection | null;
  /** Actions the calling user may take; computed by the API. */
  allowedActions: InventoryConfirmationAction[];
};

export const EMPTY_CONFIRMATION_STATE: InventoryConfirmationState = {
  confirmations: { warehouse: null, custodian: null },
  rejection: null,
  allowedActions: [],
};

export function confirmActionForParty(party: InventoryConfirmationParty): InventoryConfirmationAction {
  return party === "WAREHOUSE" ? "CONFIRM_WAREHOUSE" : "CONFIRM_CUSTODIAN";
}

export const INVENTORY_STOCK_CONDITIONS = ["AVAILABLE", "QUARANTINED"] as const;
export type InventoryStockCondition = (typeof INVENTORY_STOCK_CONDITIONS)[number];

/** Server-owned audit block (`inventory.Audit`). Never sent in write payloads. */
export type InventoryAuditFields = {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

/**
 * Optimistic-lock version required as `If-Match` on PATCH, post and cancel.
 * `null` when the API response omitted it; commands must reload first.
 */
export type InventoryVersioned = {
  version: number | null;
};

export function isInventoryDocumentStatus(value: unknown): value is InventoryDocumentStatus {
  return typeof value === "string" && (INVENTORY_DOCUMENT_STATUSES as readonly string[]).includes(value);
}

export function isInventoryStockCondition(value: unknown): value is InventoryStockCondition {
  return typeof value === "string" && (INVENTORY_STOCK_CONDITIONS as readonly string[]).includes(value);
}

let lineKeySequence = 0;

/** Stable React key for a new, unsaved document line. */
export function createInventoryLineKey(): string {
  lineKeySequence += 1;
  return `new-line-${lineKeySequence}`;
}
