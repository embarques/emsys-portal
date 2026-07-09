import { PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";

/** Maps portal routes to EMSYS API permissions (adapted from emsys-portal_v2). */
export const PAGE_PERMISSIONS: Record<string, Permission> = {
  "/": PERMISSIONS.dashboardView,
  "/customers": PERMISSIONS.clientsView,
  "/orders": PERMISSIONS.pickupsView,
  "/invoices": PERMISSIONS.invoicesView,
  "/barcodes": PERMISSIONS.packagesView,
  "/label-updater": PERMISSIONS.packagesView,
  "/inventory": PERMISSIONS.inventoryView,
  "/inventory/items": PERMISSIONS.inventoryView,
  "/inventory/receipts": PERMISSIONS.inventoryView,
  "/inventory/dispatches": PERMISSIONS.inventoryView,
  "/inventory/recipients": PERMISSIONS.inventoryView,
  "/inventory/reports": PERMISSIONS.inventoryView,
  "/items": PERMISSIONS.invoiceItemsView,
  "/containers": PERMISSIONS.containersView,
  "/routes": PERMISSIONS.dispatchView,
  "/pickup-routes": PERMISSIONS.dispatchView,
  "/delivery-routes": PERMISSIONS.dispatchView,
  "/vehicles": PERMISSIONS.vehiclesView,
  "/accounting": PERMISSIONS.incomeView,
  "/reports": PERMISSIONS.reportsView,
  "/analytics": PERMISSIONS.reportsView,
  "/users": PERMISSIONS.usersView,
  "/roles": PERMISSIONS.rolesView,
  "/employees": PERMISSIONS.employeesView,
  "/security": PERMISSIONS.usersView,
  "/settings": PERMISSIONS.accountSettingsView,
  "/branches": PERMISSIONS.branchesView,
};

export function permissionForPath(pathname: string): Permission | null {
  return PAGE_PERMISSIONS[pathname] ?? null;
}
