import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

export type InventoryStatus = "in_stock" | "low_stock" | "out_of_stock" | "reserved" | "review";

export type InventoryLocation = "ny_warehouse" | "rd_warehouse" | "in_transit" | "dock";

export type InventoryCategory = "packaging" | "labels" | "supplies" | "equipment";

/** Catalog record — stock is derived from the movement ledger. */
export type InventoryCatalogItem = {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  location: InventoryLocation;
  reorderLevel: number;
  unit: string;
  reserved: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

/** Item with computed on-hand stock and derived status. */
export type InventoryItem = InventoryCatalogItem & {
  quantity: number;
  status: InventoryStatus;
};

export type InventoryFilterState = {
  query: string;
  status: InventoryStatus | "all";
  location: InventoryLocation | "all";
  category: InventoryCategory | "all";
};

export type InventoryFormValues = {
  sku: string;
  name: string;
  category: InventoryCategory;
  location: InventoryLocation;
  reorderLevel: number;
  unit: string;
  reserved: number;
  notes: string;
  createdBy: string;
};

export const INVENTORY_LOCATIONS: { value: InventoryLocation; label: string }[] = [
  { value: "ny_warehouse", label: "NY Warehouse" },
  { value: "rd_warehouse", label: "RD Warehouse" },
  { value: "in_transit", label: "In Transit" },
  { value: "dock", label: "Loading Dock" },
];

export const INVENTORY_STATUSES: { value: InventoryStatus; label: string }[] = [
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "reserved", label: "Reserved" },
  { value: "review", label: "Needs review" },
];

export const INVENTORY_CATEGORIES: { value: InventoryCategory; label: string }[] = [
  { value: "packaging", label: "Packaging" },
  { value: "labels", label: "Labels" },
  { value: "supplies", label: "Supplies" },
  { value: "equipment", label: "Equipment" },
];

export function deriveInventoryStatus(quantity: number, reserved: number, reorderLevel: number): InventoryStatus {
  if (quantity <= 0) return "out_of_stock";
  if (reserved >= quantity) return "reserved";
  if (quantity - reserved <= reorderLevel) return "low_stock";
  return "in_stock";
}

export function createEmptyInventoryForm(): InventoryFormValues {
  return {
    sku: "",
    name: "",
    category: "supplies",
    location: "ny_warehouse",
    reserved: 0,
    reorderLevel: 10,
    unit: "units",
    notes: "",
    createdBy: DEFAULT_CREATED_BY,
  };
}
