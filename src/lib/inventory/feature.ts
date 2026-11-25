/** Inventory (navigation, `/inventory/*` workspaces, and Add transaction inventory entries) stays hidden unless enabled. */
export function isInventoryEnabled(): boolean {
  return process.env.NEXT_PUBLIC_INVENTORY_ENABLED === "true";
}
