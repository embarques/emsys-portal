import type { InventoryItem, InventoryStockBalance } from "./catalog";
import type { InventoryDispatch, InventoryReceipt } from "./documents";
import type { InventoryHolder } from "./holders";
import type { InventorySupplier } from "./suppliers";

export type InventorySnapshot = {
  items: InventoryItem[];
  receipts: InventoryReceipt[];
  dispatches: InventoryDispatch[];
  suppliers: InventorySupplier[];
  holders: InventoryHolder[];
  stock: InventoryStockBalance[];
};

export const EMPTY_INVENTORY_SNAPSHOT: InventorySnapshot = {
  items: [],
  receipts: [],
  dispatches: [],
  suppliers: [],
  holders: [],
  stock: [],
};
