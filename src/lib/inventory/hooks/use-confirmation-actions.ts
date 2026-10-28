"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { InventoryConfirmationParty, InventoryConfirmationState } from "@/lib/inventory/types/common";
import { resolveConfirmationActions } from "@/lib/inventory/utils/confirmations";

/** Confirm / reject actions the current user can take on a pending receipt, dispatch or reconciliation. */
export function useConfirmationActions(
  state: InventoryConfirmationState | null,
  parties: readonly InventoryConfirmationParty[],
) {
  const { hasPermission } = useAuth();
  if (!state) return [];
  const { inventoryConfirmWarehouse: warehouse, inventoryConfirmCustodian: custodian } = PERMISSIONS;
  return resolveConfirmationActions(state, parties, {
    WAREHOUSE: hasPermission(warehouse.name, warehouse.resourceType),
    CUSTODIAN: hasPermission(custodian.name, custodian.resourceType),
  });
}
