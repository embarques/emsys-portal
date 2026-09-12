import type { InventoryItem } from "./catalog";
import type { InventoryDispatch, InventoryReceipt } from "./documents";
import type { InventoryMovement } from "./movements";
import type { InventorySupplier } from "./suppliers";

export type InventorySnapshot = {
  items: InventoryItem[];
  receipts: InventoryReceipt[];
  dispatches: InventoryDispatch[];
  suppliers: InventorySupplier[];
  movements: InventoryMovement[];
};

export const EMPTY_INVENTORY_SNAPSHOT: InventorySnapshot = {
  items: [],
  receipts: [],
  dispatches: [],
  suppliers: [],
  movements: [],
};
