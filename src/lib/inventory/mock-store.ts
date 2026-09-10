import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { parseInventoryFormNumber } from "./types/catalog";
import type { InventoryCatalogItem, InventoryFormValues, InventoryItem } from "./types/catalog";
import type {
  AdjustmentFormValues,
  InventoryAdjustment,
  InventoryMovement,
} from "./types/movements";
import {
  dispatchedToFromFormValues,
  type DispatchFormValues,
  type InventoryDispatch,
  type InventoryReceipt,
  type ReceiptFormValues,
} from "./types/documents";
import {
  compactStringList,
  type InventorySupplier,
  type SupplierFormValues,
} from "./types/suppliers";
import { computeStockMap } from "./utils/stock";

type InventoryStoreState = {
  catalogItems: InventoryCatalogItem[];
  movements: InventoryMovement[];
  receipts: InventoryReceipt[];
  dispatches: InventoryDispatch[];
  suppliers: InventorySupplier[];
  adjustments: InventoryAdjustment[];
};

const SEED_CATALOG: InventoryCatalogItem[] = [
  {
    id: "inv-001",
    item: "Medium boxes",
    reorderThreshold: 80,
    createdAt: "2026-06-04T14:22:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "inv-002",
    item: "Thermal labels",
    reorderThreshold: 10,
    createdAt: "2026-06-04T11:05:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T11:05:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "inv-003",
    item: "Packing tape",
    reorderThreshold: 24,
    createdAt: "2026-06-03T18:40:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T18:40:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "inv-004",
    item: "Barcode scanners",
    reorderThreshold: 2,
    createdAt: "2026-06-02T09:15:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-02T09:15:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "inv-005",
    item: "Bubble wrap",
    reorderThreshold: 15,
    createdAt: "2026-06-04T08:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T08:00:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "inv-006",
    item: "Pallet wrap",
    reorderThreshold: 10,
    createdAt: "2026-06-04T16:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T16:30:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "inv-007",
    item: "Zebra labels",
    reorderThreshold: 50,
    createdAt: "2026-06-01T13:20:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-01T13:20:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "inv-008",
    item: "Large boxes",
    reorderThreshold: 20,
    createdAt: "2026-06-04T10:45:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T10:45:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "inv-009",
    item: "Markers",
    reorderThreshold: 24,
    createdAt: "2026-05-30T17:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-30T17:00:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "inv-010",
    item: "Floor scale",
    reorderThreshold: 1,
    createdAt: "2026-05-28T12:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-28T12:00:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "inv-011",
    item: "Padded mailers",
    reorderThreshold: 25,
    createdAt: "2026-06-03T07:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T07:30:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "inv-012",
    item: "Custom labels",
    reorderThreshold: 100,
    createdAt: "2026-06-04T15:10:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T15:10:00Z",
    updatedBy: "Hector Mejia",
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

const SEED_SUPPLIERS: InventorySupplier[] = [
  {
    id: "sup-001",
    companyName: "PackRight Supplies",
    contactNames: ["Maria Santos", "Luis Perez"],
    addresses: ["88 Industrial Pkwy, Elizabeth, NJ"],
    phones: [{ type: "business", number: "+19015550100", displayNumber: "(901) 555-0100", isPrimary: true }],
    emails: ["sales@packright.com"],
    createdAt: "2026-05-20T14:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-20T14:30:00Z",
    updatedBy: "Hector Mejia",
  },
  {
    id: "sup-002",
    companyName: "Harbor Packaging Co.",
    contactNames: ["Ana Rodriguez"],
    addresses: ["1200 Harbor Blvd, Newark, NJ"],
    phones: [{ type: "mobile", number: "+19735550188", displayNumber: "(973) 555-0188", isPrimary: true }],
    emails: ["orders@harborpack.com", "billing@harborpack.com"],
    createdAt: "2026-05-15T10:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-15T10:00:00Z",
    updatedBy: "Hector Mejia",
  },
];

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function averageCostForItem(itemId: string, receipts: InventoryReceipt[]): number {
  let quantity = 0;
  let cost = 0;
  for (const receipt of receipts) {
    if (receipt.itemId !== itemId) continue;
    quantity += receipt.quantity;
    cost += receipt.quantity * receipt.averageCost;
  }
  return quantity > 0 ? cost / quantity : 0;
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

function buildSeedReceipts(): { receipts: InventoryReceipt[]; movements: InventoryMovement[] } {
  const receipts: InventoryReceipt[] = [
    {
      id: "rcpt-001",
      itemId: "inv-002",
      quantity: 12,
      averageCost: 18.5,
      supplierId: "sup-001",
      receivedAt: "2026-06-03",
      createdAt: "2026-06-03T10:05:00Z",
      createdBy: DEFAULT_CREATED_BY,
      updatedAt: "2026-06-03T10:05:00Z",
      updatedBy: DEFAULT_CREATED_BY,
    },
    {
      id: "rcpt-002",
      itemId: "inv-003",
      quantity: 24,
      averageCost: 4.25,
      supplierId: "sup-001",
      receivedAt: "2026-06-03",
      createdAt: "2026-06-03T10:05:00Z",
      createdBy: DEFAULT_CREATED_BY,
      updatedAt: "2026-06-03T10:05:00Z",
      updatedBy: DEFAULT_CREATED_BY,
    },
  ];
  const movements: InventoryMovement[] = receipts.map((receipt) => ({
    id: `mov-${receipt.id}`,
    itemId: receipt.itemId,
    direction: "IN" as const,
    quantity: receipt.quantity,
    movementDate: receipt.receivedAt,
    referenceType: "receipt" as const,
    referenceId: receipt.id,
    createdBy: DEFAULT_CREATED_BY,
  }));
  return { receipts, movements };
}

function buildSeedDispatches(): { dispatches: InventoryDispatch[]; movements: InventoryMovement[] } {
  const dispatches: InventoryDispatch[] = [
    {
      id: "dsp-001",
      itemId: "inv-001",
      quantity: 48,
      incomeGained: 96,
      dispatchedAt: "2026-06-04",
      dispatchedTo: { id: 12, name: "Hector Mejia" },
      createdAt: "2026-06-04T14:05:00Z",
      createdBy: DEFAULT_CREATED_BY,
      updatedAt: "2026-06-04T14:05:00Z",
      updatedBy: DEFAULT_CREATED_BY,
    },
    {
      id: "dsp-002",
      itemId: "inv-002",
      quantity: 6,
      incomeGained: 150,
      dispatchedAt: "2026-06-04",
      dispatchedTo: {
        id: "674a1b2c3d4e5f6789012301",
        name: "NY Pickup A",
        route: { id: "674a1b2c3d4e5f6789012302", name: "Crew A" },
      },
      createdAt: "2026-06-04T14:05:00Z",
      createdBy: DEFAULT_CREATED_BY,
      updatedAt: "2026-06-04T14:05:00Z",
      updatedBy: DEFAULT_CREATED_BY,
    },
  ];
  const movements: InventoryMovement[] = dispatches.map((dispatch) => ({
    id: `mov-${dispatch.id}`,
    itemId: dispatch.itemId,
    direction: "OUT" as const,
    quantity: dispatch.quantity,
    movementDate: dispatch.dispatchedAt,
    referenceType: "dispatch" as const,
    referenceId: dispatch.id,
    createdBy: DEFAULT_CREATED_BY,
  }));
  return { dispatches, movements };
}

function createInitialStore(): InventoryStoreState {
  const openingMovements = buildOpeningMovements();
  const seedReceipts = buildSeedReceipts();
  const seedDispatches = buildSeedDispatches();

  return {
    catalogItems: SEED_CATALOG.map((item) => ({ ...item })),
    movements: [...openingMovements, ...seedReceipts.movements, ...seedDispatches.movements],
    receipts: seedReceipts.receipts,
    dispatches: seedDispatches.dispatches,
    suppliers: SEED_SUPPLIERS.map((supplier) => ({ ...supplier })),
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
      averageCost: averageCostForItem(item.id, store.receipts),
    };
  });
}

export function getInventoryStoreSnapshot() {
  return {
    items: withComputedItems(store.catalogItems, store.movements),
    catalogItems: [...store.catalogItems],
    movements: [...store.movements],
    receipts: [...store.receipts],
    dispatches: [...store.dispatches],
    suppliers: [...store.suppliers],
    adjustments: [...store.adjustments],
  };
}

export function getItemStock(itemId: string): number {
  return computeStockMap(store.movements).get(itemId) ?? 0;
}

function catalogFieldsFromForm(values: InventoryFormValues) {
  return {
    item: values.item.trim(),
    reorderThreshold: parseInventoryFormNumber(values.reorderThreshold),
  };
}

export function createCatalogItem(values: InventoryFormValues): InventoryItem {
  const now = new Date().toISOString();
  const catalogItem: InventoryCatalogItem = {
    id: createId("inv"),
    ...catalogFieldsFromForm(values),
    createdAt: now,
    createdBy: values.createdBy,
    updatedAt: now,
    updatedBy: values.createdBy,
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
    ...catalogFieldsFromForm(values),
    updatedAt: new Date().toISOString(),
    updatedBy: values.createdBy || existing.updatedBy,
  };
  store.catalogItems[index] = updated;
  return withComputedItems([updated], store.movements)[0]!;
}

export function deleteCatalogItems(ids: string[]): void {
  store.catalogItems = store.catalogItems.filter((item) => !ids.includes(item.id));
  store.movements = store.movements.filter((movement) => !ids.includes(movement.itemId));
}

export function createReceipt(values: ReceiptFormValues): InventoryReceipt {
  const quantity = parseInventoryFormNumber(values.quantity);
  const receipt: InventoryReceipt = {
    id: createId("rcpt"),
    itemId: values.itemId,
    quantity,
    averageCost: parseInventoryFormNumber(values.averageCost),
    supplierId: values.supplierId,
    receivedAt: values.receivedAt,
    createdAt: new Date().toISOString(),
    createdBy: DEFAULT_CREATED_BY,
    updatedAt: new Date().toISOString(),
    updatedBy: DEFAULT_CREATED_BY,
  };
  const movement: InventoryMovement = {
    id: createId("mov"),
    itemId: receipt.itemId,
    direction: "IN",
    quantity: receipt.quantity,
    movementDate: receipt.receivedAt,
    referenceType: "receipt",
    referenceId: receipt.id,
    createdBy: DEFAULT_CREATED_BY,
  };

  store.receipts = [receipt, ...store.receipts];
  store.movements = [movement, ...store.movements];
  return receipt;
}

export function createDispatch(values: DispatchFormValues): InventoryDispatch {
  const quantity = parseInventoryFormNumber(values.quantity);
  const available = getItemStock(values.itemId);
  if (quantity > available) {
    const item = store.catalogItems.find((entry) => entry.id === values.itemId);
    throw new Error(`Insufficient stock for ${item?.item ?? values.itemId}`);
  }
  const dispatchedTo = dispatchedToFromFormValues(values);
  if (!dispatchedTo) {
    throw new Error("Dispatched to is required");
  }

  const now = new Date().toISOString();
  const dispatch: InventoryDispatch = {
    id: createId("dsp"),
    itemId: values.itemId,
    quantity,
    incomeGained: parseInventoryFormNumber(values.incomeGained),
    dispatchedAt: values.dispatchedAt,
    dispatchedTo,
    createdAt: now,
    createdBy: DEFAULT_CREATED_BY,
    updatedAt: now,
    updatedBy: DEFAULT_CREATED_BY,
  };
  const movement: InventoryMovement = {
    id: createId("mov"),
    itemId: dispatch.itemId,
    direction: "OUT",
    quantity: dispatch.quantity,
    movementDate: dispatch.dispatchedAt,
    referenceType: "dispatch",
    referenceId: dispatch.id,
    createdBy: DEFAULT_CREATED_BY,
  };

  store.dispatches = [dispatch, ...store.dispatches];
  store.movements = [movement, ...store.movements];
  return dispatch;
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

export function createSupplier(values: SupplierFormValues): InventorySupplier {
  const supplier: InventorySupplier = {
    id: createId("sup"),
    companyName: values.companyName.trim(),
    contactNames: compactStringList(values.contactNames),
    addresses: compactStringList(values.addresses),
    phones: values.phones.map((phone) => ({ ...phone })),
    emails: compactStringList(values.emails),
    createdAt: new Date().toISOString(),
    createdBy: DEFAULT_CREATED_BY,
    updatedAt: new Date().toISOString(),
    updatedBy: DEFAULT_CREATED_BY,
  };
  store.suppliers = [supplier, ...store.suppliers];
  return supplier;
}

export function updateSupplier(id: string, values: SupplierFormValues): InventorySupplier {
  const index = store.suppliers.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error("Supplier not found");
  const updated: InventorySupplier = {
    ...store.suppliers[index]!,
    companyName: values.companyName.trim(),
    contactNames: compactStringList(values.contactNames),
    addresses: compactStringList(values.addresses),
    phones: values.phones.map((phone) => ({ ...phone })),
    emails: compactStringList(values.emails),
    updatedAt: new Date().toISOString(),
    updatedBy: DEFAULT_CREATED_BY,
  };
  store.suppliers[index] = updated;
  return updated;
}

export function deleteSuppliers(ids: string[]): void {
  store.suppliers = store.suppliers.filter((entry) => !ids.includes(entry.id));
}

/** Test helper — resets in-memory store to seed data. */
export function resetInventoryStore(): void {
  store = createInitialStore();
}
