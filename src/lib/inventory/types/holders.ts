import type { InventoryAuditFields, InventoryVersioned } from "./common";

export const INVENTORY_HOLDER_TYPES = ["WAREHOUSE", "EMPLOYEE", "VEHICLE", "ROUTE_CREW"] as const;
export type InventoryHolderType = (typeof INVENTORY_HOLDER_TYPES)[number];

/** Holders that receive warehouse dispatches. Daily routes are context only, never holders. */
export const INVENTORY_CUSTODIAN_HOLDER_TYPES = ["EMPLOYEE", "VEHICLE", "ROUTE_CREW"] as const satisfies readonly InventoryHolderType[];

/** Persistent owner of stock (`inventory.InventoryHolder`). */
export type InventoryHolder = InventoryAuditFields &
  InventoryVersioned & {
    id: string;
    type: InventoryHolderType;
    displayName: string;
    /** Employee, vehicle or route-crew ID. Empty for warehouses. */
    entityId: string;
    isActive: boolean;
  };

export type InventoryHolderFormValues = {
  type: InventoryHolderType;
  displayName: string;
  entityId: string;
};

export function isInventoryHolderType(value: unknown): value is InventoryHolderType {
  return typeof value === "string" && (INVENTORY_HOLDER_TYPES as readonly string[]).includes(value);
}

export function createEmptyHolderForm(type: InventoryHolderType = "WAREHOUSE"): InventoryHolderFormValues {
  return { type, displayName: "", entityId: "" };
}

export type InventoryRouteCrew = {
  id: string;
  name: string;
  isActive: boolean;
};
