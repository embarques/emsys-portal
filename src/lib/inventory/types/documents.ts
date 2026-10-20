import type { ApiTableRecord } from "@/lib/table/api-table-fields";
import { toDateTimeLocalInput } from "@/lib/inventory/utils/date-time";
import { minorToUsdInput } from "@/lib/inventory/utils/money";

import {
  createInventoryLineKey,
  type InventoryAuditFields,
  type InventoryDocumentStatus,
  type InventoryVersioned,
} from "./common";

/** Fields shared by versioned stock documents (receipts, dispatches). */
type InventoryDocumentBase = ApiTableRecord &
  InventoryAuditFields &
  InventoryVersioned & {
    id: string;
    status: InventoryDocumentStatus;
    notes: string;
    postedAt: string;
    postedBy: string;
    /** Set when this document corrects an earlier posted one. */
    correctsSourceId: string;
  };

export type InventoryReceiptLine = {
  id?: string;
  itemId: string;
  quantity: number;
  unitCostMinor: number;
};

/** Purchase received into a warehouse (`inventory.Receipt`). Posting increases stock and valuation. */
export type InventoryReceipt = InventoryDocumentBase & {
  supplierId: string;
  toHolderId: string;
  receivedAt: string;
  lines: InventoryReceiptLine[];
};

export type InventoryDispatchLine = {
  id?: string;
  itemId: string;
  quantity: number;
};

/** Warehouse → custodian transfer (`inventory.Dispatch`). Records no revenue. */
export type InventoryDispatch = InventoryDocumentBase & {
  fromHolderId: string;
  toHolderId: string;
  assigneeEmployeeId: string;
  /** Daily route context only; the destination is always `toHolderId`. */
  dailyRouteId: string;
  dispatchedAt: string;
  lines: InventoryDispatchLine[];
};

export type ReceiptLineFormValues = {
  key: string;
  id?: string;
  itemId: string;
  quantity: string;
  /** USD text; converted exactly to `unitCostMinor`. */
  unitCost: string;
};

export type ReceiptFormValues = {
  supplierId: string;
  toHolderId: string;
  /** `datetime-local` value; sent as a UTC instant. */
  receivedAt: string;
  notes: string;
  lines: ReceiptLineFormValues[];
};

export type DispatchLineFormValues = {
  key: string;
  id?: string;
  itemId: string;
  quantity: string;
};

export type DispatchFormValues = {
  fromHolderId: string;
  toHolderId: string;
  assigneeEmployeeId: string;
  dailyRouteId: string;
  /** `datetime-local` value; sent as a UTC instant. */
  dispatchedAt: string;
  notes: string;
  lines: DispatchLineFormValues[];
};

export function createEmptyReceiptLine(): ReceiptLineFormValues {
  return { key: createInventoryLineKey(), itemId: "", quantity: "", unitCost: "" };
}

export function createEmptyDispatchLine(): DispatchLineFormValues {
  return { key: createInventoryLineKey(), itemId: "", quantity: "" };
}

export function createEmptyReceiptForm(receivedAt = toDateTimeLocalInput()): ReceiptFormValues {
  return {
    supplierId: "",
    toHolderId: "",
    receivedAt,
    notes: "",
    lines: [createEmptyReceiptLine()],
  };
}

export function createEmptyDispatchForm(dispatchedAt = toDateTimeLocalInput()): DispatchFormValues {
  return {
    fromHolderId: "",
    toHolderId: "",
    assigneeEmployeeId: "",
    dailyRouteId: "",
    dispatchedAt,
    notes: "",
    lines: [createEmptyDispatchLine()],
  };
}

export function receiptToFormValues(receipt: InventoryReceipt): ReceiptFormValues {
  return {
    supplierId: receipt.supplierId,
    toHolderId: receipt.toHolderId,
    receivedAt: toDateTimeLocalInput(receipt.receivedAt),
    notes: receipt.notes,
    lines: receipt.lines.map((line, index) => ({
      key: line.id ?? `line-${index}`,
      id: line.id,
      itemId: line.itemId,
      quantity: String(line.quantity),
      unitCost: minorToUsdInput(line.unitCostMinor),
    })),
  };
}

export function dispatchToFormValues(dispatch: InventoryDispatch): DispatchFormValues {
  return {
    fromHolderId: dispatch.fromHolderId,
    toHolderId: dispatch.toHolderId,
    assigneeEmployeeId: dispatch.assigneeEmployeeId,
    dailyRouteId: dispatch.dailyRouteId,
    dispatchedAt: toDateTimeLocalInput(dispatch.dispatchedAt),
    notes: dispatch.notes,
    lines: dispatch.lines.map((line, index) => ({
      key: line.id ?? `line-${index}`,
      id: line.id,
      itemId: line.itemId,
      quantity: String(line.quantity),
    })),
  };
}

export function isInventoryDocumentDraft(document: { status: InventoryDocumentStatus }): boolean {
  return document.status === "DRAFT";
}

export function sumReceiptLinesMinor(lines: InventoryReceiptLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity * line.unitCostMinor, 0);
}

export function sumLineQuantities(lines: { quantity: number }[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
