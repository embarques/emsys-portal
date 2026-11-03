"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";

/** Reuse the inventory handoff/payment flow and its existing permission grants. */
export function useInventoryPaymentEntry() {
  const { hasPermission } = useAuth();
  const { openTab } = useWorkspaceTabs();
  const list = PERMISSIONS.inventoryDispatchesList;
  const reconcile = PERMISSIONS.inventoryDispatchesReconcile;
  const permitted = hasPermission(list.name, list.resourceType) && hasPermission(reconcile.name, reconcile.resourceType);
  return permitted ? () => openTab("/inventory/pending-transactions") : undefined;
}
