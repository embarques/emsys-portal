import type { ApiTableRecord } from "@/lib/table/api-table-fields";
import { minorToUsdInput } from "@/lib/inventory/utils/money";

import type { InventoryAuditFields, InventoryStockCondition, InventoryVersioned } from "./common";

/** Supply catalog record (`inventory.Item`). Quantities come from stock balances, never the item. */
export type InventoryItem = ApiTableRecord &
  InventoryAuditFields &
  InventoryVersioned & {
    id: string;
    sku: string;
    name: string;
    unitOfMeasure: string;
    category: string;
    /** Integer USD cents; `null` when the API omits a default price. */
    defaultSellingPriceMinor: number | null;
    currency: string;
    reorderThreshold: number;
    isActive: boolean;
  };

/** Ledger balance for one item, holder and condition (`inventory.StockBalance`). Read-only. */
export type InventoryStockBalance = InventoryVersioned & {
  id: string;
  holderId: string;
  itemId: string;
  condition: InventoryStockCondition;
  quantityOnHand: number;
  quantityReserved: number;
  updatedAt: string;
};

/** Company-wide stock for one item, aggregated from its balances. */
export type InventoryItemStockSummary = {
  available: number;
  quarantined: number;
  reserved: number;
};

export const EMPTY_ITEM_STOCK_SUMMARY: InventoryItemStockSummary = {
  available: 0,
  quarantined: 0,
  reserved: 0,
};

export type InventoryFilterState = {
  query: string;
};

export type InventoryFormValues = {
  sku: string;
  name: string;
  unitOfMeasure: string;
  category: string;
  /** USD text; converted exactly to `defaultSellingPriceMinor`. */
  defaultSellingPrice: string;
  reorderThreshold: string;
};

export function createEmptyInventoryForm(): InventoryFormValues {
  return {
    sku: "",
    name: "",
    unitOfMeasure: "",
    category: "",
    defaultSellingPrice: "",
    reorderThreshold: "",
  };
}

export function inventoryItemToFormValues(item: InventoryItem): InventoryFormValues {
  return {
    sku: item.sku,
    name: item.name,
    unitOfMeasure: item.unitOfMeasure,
    category: item.category,
    defaultSellingPrice: minorToUsdInput(item.defaultSellingPriceMinor),
    reorderThreshold: String(item.reorderThreshold),
  };
}

export function summarizeItemStock(balances: InventoryStockBalance[]): Map<string, InventoryItemStockSummary> {
  const summaries = new Map<string, InventoryItemStockSummary>();
  for (const balance of balances) {
    const current = summaries.get(balance.itemId) ?? { ...EMPTY_ITEM_STOCK_SUMMARY };
    if (balance.condition === "QUARANTINED") {
      current.quarantined += balance.quantityOnHand;
    } else {
      current.available += balance.quantityOnHand;
    }
    current.reserved += balance.quantityReserved;
    summaries.set(balance.itemId, current);
  }
  return summaries;
}
