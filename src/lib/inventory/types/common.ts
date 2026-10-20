export const INVENTORY_DOCUMENT_STATUSES = ["DRAFT", "POSTED", "CANCELLED"] as const;
export type InventoryDocumentStatus = (typeof INVENTORY_DOCUMENT_STATUSES)[number];

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
