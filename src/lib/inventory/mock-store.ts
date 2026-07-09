import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { deriveInventoryStatus } from "./types/catalog";
import type { InventoryCatalogItem, InventoryFormValues, InventoryItem } from "./types/catalog";
import type {
  AdjustmentFormValues,
  InventoryAdjustment,
  InventoryMovement,
} from "./types/movements";
import type {
  DispatchFormValues,
  InventoryDispatch,
  InventoryDispatchLine,
  InventoryReceipt,
  InventoryReceiptLine,
  ReceiptFormValues,
} from "./types/documents";
import type { InventoryRecipient, RecipientFormValues } from "./types/recipients";
import { computeStockMap } from "./utils/stock";

type InventoryStoreState = {
  catalogItems: InventoryCatalogItem[];
  movements: InventoryMovement[];
  receipts: InventoryReceipt[];
  receiptLines: InventoryReceiptLine[];
  dispatches: InventoryDispatch[];
  dispatchLines: InventoryDispatchLine[];
  recipients: InventoryRecipient[];
  adjustments: InventoryAdjustment[];
};

const SEED_CATALOG: InventoryCatalogItem[] = [
  {
    id: "inv-001",
    sku: "PKG-BOX-M",
    name: "Medium shipping boxes (18x12x10)",
    category: "packaging",
    location: "ny_warehouse",
    reorderLevel: 100,
    unit: "boxes",
    reserved: 48,
    notes: "Primary outbound carton for domestic routes.",
    createdAt: "2026-06-04T14:22:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
  },
  {
    id: "inv-002",
    sku: "LBL-4X6-ROLL",
    name: "Thermal label rolls 4x6",
    category: "labels",
    location: "ny_warehouse",
    reorderLevel: 20,
    unit: "rolls",
    reserved: 6,
    createdAt: "2026-06-04T11:05:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T11:05:00Z",
  },
  {
    id: "inv-003",
    sku: "PKG-TAPE-CLR",
    name: "Clear packing tape",
    category: "supplies",
    location: "rd_warehouse",
    reorderLevel: 30,
    unit: "rolls",
    reserved: 12,
    createdAt: "2026-06-03T18:40:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T18:40:00Z",
  },
  {
    id: "inv-004",
    sku: "EQP-SCAN-HH",
    name: "Handheld barcode scanners",
    category: "equipment",
    location: "ny_warehouse",
    reorderLevel: 2,
    unit: "units",
    reserved: 0,
    notes: "Reorder approved — vendor lead time 5 days.",
    createdAt: "2026-06-02T09:15:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-02T09:15:00Z",
  },
  {
    id: "inv-005",
    sku: "PKG-BUBBLE-L",
    name: "Large bubble wrap rolls",
    category: "packaging",
    location: "in_transit",
    reorderLevel: 15,
    unit: "rolls",
    reserved: 60,
    createdAt: "2026-06-04T08:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T08:00:00Z",
  },
  {
    id: "inv-006",
    sku: "SUP-PALLET-WRAP",
    name: "Stretch pallet wrap",
    category: "supplies",
    location: "dock",
    reorderLevel: 12,
    unit: "rolls",
    reserved: 0,
    notes: "Count mismatch after last unload — recount scheduled.",
    createdAt: "2026-06-04T16:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T16:30:00Z",
  },
  {
    id: "inv-007",
    sku: "LBL-ZEB-203",
    name: "Zebra 203 DPI label stock",
    category: "labels",
    location: "rd_warehouse",
    reorderLevel: 50,
    unit: "sheets",
    reserved: 20,
    createdAt: "2026-06-01T13:20:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-01T13:20:00Z",
  },
  {
    id: "inv-008",
    sku: "PKG-BOX-L",
    name: "Large shipping boxes (24x18x12)",
    category: "packaging",
    location: "ny_warehouse",
    reorderLevel: 25,
    unit: "boxes",
    reserved: 2,
    createdAt: "2026-06-04T10:45:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T10:45:00Z",
  },
  {
    id: "inv-009",
    sku: "SUP-MARK-BLK",
    name: "Permanent markers (black)",
    category: "supplies",
    location: "rd_warehouse",
    reorderLevel: 40,
    unit: "units",
    reserved: 0,
    createdAt: "2026-05-30T17:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-30T17:00:00Z",
  },
  {
    id: "inv-010",
    sku: "EQP-SCALE-50",
    name: "50 lb digital floor scale",
    category: "equipment",
    location: "dock",
    reorderLevel: 1,
    unit: "units",
    reserved: 1,
    createdAt: "2026-05-28T12:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-28T12:00:00Z",
  },
  {
    id: "inv-011",
    sku: "PKG-ENVELOPE",
    name: "Padded mailers 10x13",
    category: "packaging",
    location: "ny_warehouse",
    reorderLevel: 80,
    unit: "units",
    reserved: 0,
    createdAt: "2026-06-03T07:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T07:30:00Z",
  },
  {
    id: "inv-012",
    sku: "LBL-CUSTOM-A",
    name: "Custom client label template A",
    category: "labels",
    location: "in_transit",
    reorderLevel: 100,
    unit: "labels",
    reserved: 120,
    createdAt: "2026-06-04T15:10:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T15:10:00Z",
  },
];

const OPENING_BALANCES: Record<string, number> = {
  "inv-001": 420,
  "inv-002": 18,
  "inv-003": 96,
  "inv-004": 0,
  "inv-005": 60,
  "inv-006": 34,
  "inv-007": 240,
  "inv-008": 8,
  "inv-009": 150,
  "inv-010": 3,
  "inv-011": 0,
  "inv-012": 500,
};

const SEED_RECIPIENTS: InventoryRecipient[] = [
  {
    id: "rcp-001",
    name: "Acme Logistics",
    type: "customer",
    contactInfo: "ops@acmelogistics.com",
    address: "1200 Harbor Blvd, Newark, NJ",
    createdAt: "2026-05-15T10:00:00Z",
  },
  {
    id: "rcp-002",
    name: "PackRight Supplies",
    type: "vendor",
    contactInfo: "sales@packright.com",
    address: "88 Industrial Pkwy, Elizabeth, NJ",
    createdAt: "2026-05-20T14:30:00Z",
  },
  {
    id: "rcp-003",
    name: "RD Branch",
    type: "branch",
    contactInfo: "rd-warehouse@emsys.com",
    address: "Santo Domingo, DR",
    createdAt: "2026-05-22T09:00:00Z",
  },
  {
    id: "rcp-004",
    name: "Internal — Route Prep",
    type: "internal",
    contactInfo: "dispatch@emsys.com",
    createdAt: "2026-06-01T08:00:00Z",
  },
];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function buildOpeningMovements(): InventoryMovement[] {
  return Object.entries(OPENING_BALANCES)
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId, quantity]) => ({
      id: `mov-open-${itemId}`,
      itemId,
      direction: "ADJUSTMENT" as const,
      quantity,
      adjustmentSign: "increase" as const,
      movementDate: "2026-06-01T00:00:00Z",
      referenceType: "adjustment" as const,
      referenceId: `adj-open-${itemId}`,
      createdBy: DEFAULT_CREATED_BY,
      notes: "Opening balance migration",
    }));
}

function buildSeedReceipt(): {
  receipt: InventoryReceipt;
  lines: InventoryReceiptLine[];
  movements: InventoryMovement[];
} {
  const receipt: InventoryReceipt = {
    id: "rcpt-001",
    receiptDate: "2026-06-03T10:00:00Z",
    source: "PackRight Supplies",
    receivedBy: "Hector Mejia",
    notes: "Restock of label supplies",
    createdAt: "2026-06-03T10:05:00Z",
  };
  const lines: InventoryReceiptLine[] = [
    { id: "rcl-001", receiptId: receipt.id, itemId: "inv-002", quantity: 12 },
    { id: "rcl-002", receiptId: receipt.id, itemId: "inv-003", quantity: 24 },
  ];
  const movements: InventoryMovement[] = lines.map((line) => ({
    id: `mov-${line.id}`,
    itemId: line.itemId,
    direction: "IN",
    quantity: line.quantity,
    movementDate: receipt.receiptDate,
    referenceType: "receipt",
    referenceId: receipt.id,
    createdBy: receipt.receivedBy,
  }));
  return { receipt, lines, movements };
}

function buildSeedDispatch(): {
  dispatch: InventoryDispatch;
  lines: InventoryDispatchLine[];
  movements: InventoryMovement[];
} {
  const dispatch: InventoryDispatch = {
    id: "dsp-001",
    dispatchDate: "2026-06-04T14:00:00Z",
    recipientId: "rcp-001",
    dispatchedBy: "Hector Mejia",
    status: "sent",
    invoiceNumber: "INV-2026-0412",
    notes: "Weekly replenishment",
    createdAt: "2026-06-04T14:05:00Z",
  };
  const lines: InventoryDispatchLine[] = [
    { id: "dpl-001", dispatchId: dispatch.id, itemId: "inv-001", quantity: 48 },
    { id: "dpl-002", dispatchId: dispatch.id, itemId: "inv-002", quantity: 6 },
  ];
  const movements: InventoryMovement[] = lines.map((line) => ({
    id: `mov-${line.id}`,
    itemId: line.itemId,
    direction: "OUT",
    quantity: line.quantity,
    movementDate: dispatch.dispatchDate,
    referenceType: "dispatch",
    referenceId: dispatch.id,
    createdBy: dispatch.dispatchedBy,
  }));
  return { dispatch, lines, movements };
}

function createInitialStore(): InventoryStoreState {
  const openingMovements = buildOpeningMovements();
  const seedReceipt = buildSeedReceipt();
  const seedDispatch = buildSeedDispatch();

  return {
    catalogItems: SEED_CATALOG.map((item) => ({ ...item })),
    movements: [...openingMovements, ...seedReceipt.movements, ...seedDispatch.movements],
    receipts: [seedReceipt.receipt],
    receiptLines: seedReceipt.lines,
    dispatches: [seedDispatch.dispatch],
    dispatchLines: seedDispatch.lines,
    recipients: SEED_RECIPIENTS.map((recipient) => ({ ...recipient })),
    adjustments: openingMovements.map((movement) => ({
      id: movement.referenceId,
      itemId: movement.itemId,
      adjustmentSign: movement.adjustmentSign ?? "increase",
      quantity: movement.quantity,
      reason: "recount" as const,
      notes: movement.notes,
      movementDate: movement.movementDate,
      createdBy: movement.createdBy,
      createdAt: movement.movementDate,
    })),
  };
}

let store: InventoryStoreState = createInitialStore();

function withComputedItems(catalogItems: InventoryCatalogItem[], movements: InventoryMovement[]): InventoryItem[] {
  const stockMap = computeStockMap(movements);
  return catalogItems.map((item) => {
    const quantity = stockMap.get(item.id) ?? 0;
    return {
      ...item,
      quantity,
      status: deriveInventoryStatus(quantity, item.reserved, item.reorderLevel),
    };
  });
}

export function getInventoryStoreSnapshot() {
  return {
    items: withComputedItems(store.catalogItems, store.movements),
    catalogItems: [...store.catalogItems],
    movements: [...store.movements],
    receipts: [...store.receipts],
    receiptLines: [...store.receiptLines],
    dispatches: [...store.dispatches],
    dispatchLines: [...store.dispatchLines],
    recipients: [...store.recipients],
    adjustments: [...store.adjustments],
  };
}

export function getItemStock(itemId: string): number {
  return computeStockMap(store.movements).get(itemId) ?? 0;
}

export function createCatalogItem(values: InventoryFormValues): InventoryItem {
  const now = new Date().toISOString();
  const catalogItem: InventoryCatalogItem = {
    id: createId("inv"),
    sku: values.sku,
    name: values.name,
    category: values.category,
    location: values.location,
    reorderLevel: values.reorderLevel,
    unit: values.unit,
    reserved: values.reserved,
    notes: values.notes || undefined,
    createdAt: now,
    createdBy: values.createdBy,
    updatedAt: now,
  };
  store.catalogItems = [catalogItem, ...store.catalogItems];
  return withComputedItems([catalogItem], store.movements)[0]!;
}

export function updateCatalogItem(id: string, values: InventoryFormValues): InventoryItem {
  const index = store.catalogItems.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("Item not found");
  const existing = store.catalogItems[index]!;
  const updated: InventoryCatalogItem = {
    ...existing,
    sku: values.sku,
    name: values.name,
    category: values.category,
    location: values.location,
    reorderLevel: values.reorderLevel,
    unit: values.unit,
    reserved: values.reserved,
    notes: values.notes || undefined,
    updatedAt: new Date().toISOString(),
  };
  store.catalogItems[index] = updated;
  return withComputedItems([updated], store.movements)[0]!;
}

export function deleteCatalogItems(ids: string[]): void {
  store.catalogItems = store.catalogItems.filter((item) => !ids.includes(item.id));
  store.movements = store.movements.filter((movement) => !ids.includes(movement.itemId));
}

export function createReceipt(values: ReceiptFormValues): InventoryReceipt {
  const receipt: InventoryReceipt = {
    id: createId("rcpt"),
    receiptDate: values.receiptDate,
    source: values.source,
    receivedBy: values.receivedBy,
    notes: values.notes || undefined,
    createdAt: new Date().toISOString(),
  };
  const lines: InventoryReceiptLine[] = values.lines.map((line) => ({
    id: createId("rcl"),
    receiptId: receipt.id,
    itemId: line.itemId,
    quantity: line.quantity,
  }));
  const movements: InventoryMovement[] = lines.map((line) => ({
    id: createId("mov"),
    itemId: line.itemId,
    direction: "IN",
    quantity: line.quantity,
    movementDate: receipt.receiptDate,
    referenceType: "receipt",
    referenceId: receipt.id,
    createdBy: values.receivedBy,
    notes: values.notes || undefined,
  }));

  store.receipts = [receipt, ...store.receipts];
  store.receiptLines = [...lines, ...store.receiptLines];
  store.movements = [...movements, ...store.movements];
  return receipt;
}

export function createDispatch(values: DispatchFormValues): InventoryDispatch {
  for (const line of values.lines) {
    const available = getItemStock(line.itemId);
    if (values.markSent && line.quantity > available) {
      const item = store.catalogItems.find((entry) => entry.id === line.itemId);
      throw new Error(`Insufficient stock for ${item?.name ?? line.itemId}`);
    }
  }

  const dispatch: InventoryDispatch = {
    id: createId("dsp"),
    dispatchDate: values.dispatchDate,
    recipientId: values.recipientId,
    dispatchedBy: values.dispatchedBy,
    status: values.markSent ? "sent" : "pending",
    invoiceNumber: values.invoiceNumber || undefined,
    notes: values.notes || undefined,
    createdAt: new Date().toISOString(),
  };
  const lines: InventoryDispatchLine[] = values.lines.map((line) => ({
    id: createId("dpl"),
    dispatchId: dispatch.id,
    itemId: line.itemId,
    quantity: line.quantity,
  }));

  store.dispatches = [dispatch, ...store.dispatches];
  store.dispatchLines = [...lines, ...store.dispatchLines];

  if (values.markSent) {
    const movements: InventoryMovement[] = lines.map((line) => ({
      id: createId("mov"),
      itemId: line.itemId,
      direction: "OUT",
      quantity: line.quantity,
      movementDate: dispatch.dispatchDate,
      referenceType: "dispatch",
      referenceId: dispatch.id,
      createdBy: values.dispatchedBy,
      notes: values.notes || undefined,
    }));
    store.movements = [...movements, ...store.movements];
  }

  return dispatch;
}

export function updateDispatchStatus(dispatchId: string, status: InventoryDispatch["status"]): InventoryDispatch {
  const index = store.dispatches.findIndex((entry) => entry.id === dispatchId);
  if (index < 0) throw new Error("Dispatch not found");
  const dispatch = store.dispatches[index]!;
  if (dispatch.status === status) return dispatch;

  if (status === "sent" && dispatch.status === "pending") {
    const lines = store.dispatchLines.filter((line) => line.dispatchId === dispatchId);
    for (const line of lines) {
      const available = getItemStock(line.itemId);
      if (line.quantity > available) {
        const item = store.catalogItems.find((entry) => entry.id === line.itemId);
        throw new Error(`Insufficient stock for ${item?.name ?? line.itemId}`);
      }
    }
    const movements: InventoryMovement[] = lines.map((line) => ({
      id: createId("mov"),
      itemId: line.itemId,
      direction: "OUT",
      quantity: line.quantity,
      movementDate: dispatch.dispatchDate,
      referenceType: "dispatch",
      referenceId: dispatch.id,
      createdBy: dispatch.dispatchedBy,
    }));
    store.movements = [...movements, ...store.movements];
  }

  const updated = { ...dispatch, status };
  store.dispatches[index] = updated;
  return updated;
}

export function createAdjustment(values: AdjustmentFormValues): InventoryAdjustment {
  const adjustment: InventoryAdjustment = {
    id: createId("adj"),
    itemId: values.itemId,
    adjustmentSign: values.adjustmentSign,
    quantity: values.quantity,
    reason: values.reason,
    notes: values.notes || undefined,
    movementDate: values.movementDate,
    createdBy: values.createdBy,
    createdAt: new Date().toISOString(),
  };
  const movement: InventoryMovement = {
    id: createId("mov"),
    itemId: values.itemId,
    direction: "ADJUSTMENT",
    quantity: values.quantity,
    adjustmentSign: values.adjustmentSign,
    movementDate: values.movementDate,
    referenceType: "adjustment",
    referenceId: adjustment.id,
    createdBy: values.createdBy,
    notes: values.notes || undefined,
  };

  store.adjustments = [adjustment, ...store.adjustments];
  store.movements = [movement, ...store.movements];
  return adjustment;
}

export function createRecipient(values: RecipientFormValues): InventoryRecipient {
  const recipient: InventoryRecipient = {
    id: createId("rcp"),
    name: values.name,
    type: values.type,
    contactInfo: values.contactInfo || undefined,
    address: values.address || undefined,
    createdAt: new Date().toISOString(),
  };
  store.recipients = [recipient, ...store.recipients];
  return recipient;
}

export function updateRecipient(id: string, values: RecipientFormValues): InventoryRecipient {
  const index = store.recipients.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error("Recipient not found");
  const updated: InventoryRecipient = {
    ...store.recipients[index]!,
    name: values.name,
    type: values.type,
    contactInfo: values.contactInfo || undefined,
    address: values.address || undefined,
  };
  store.recipients[index] = updated;
  return updated;
}

export function deleteRecipients(ids: string[]): void {
  store.recipients = store.recipients.filter((entry) => !ids.includes(entry.id));
}

/** Test helper — resets in-memory store to seed data. */
export function resetInventoryStore(): void {
  store = createInitialStore();
}
