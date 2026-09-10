import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

/** Catalog record — quantity left is derived from receipts and dispatches. */
export type InventoryCatalogItem = {
  id: string;
  item: string;
  reorderThreshold: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

/** Item with computed quantity left and average receipt cost. */
export type InventoryItem = InventoryCatalogItem & {
  quantity: number;
  averageCost: number;
};

/** On-hand projection — one row per catalog item. */
export type InventoryStock = {
  id: string;
  itemId: string;
  quantity: number;
  averageCost: number;
  reorderThreshold: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type InventoryFilterState = {
  query: string;
};

export type InventoryFormValues = {
  item: string;
  reorderThreshold: string;
  createdBy: string;
};

export function parseInventoryFormNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

export function createEmptyInventoryForm(): InventoryFormValues {
  return {
    item: "",
    reorderThreshold: "",
    createdBy: DEFAULT_CREATED_BY,
  };
}

export function inventoryItemToFormValues(item: InventoryItem): InventoryFormValues {
  return {
    item: item.item,
    reorderThreshold: item.reorderThreshold > 0 ? String(item.reorderThreshold) : "",
    createdBy: item.createdBy,
  };
}
