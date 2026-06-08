import { PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";

/** Maps portal routes to EMSYS API permissions (adapted from emsys-portal_v2). */
export const PAGE_PERMISSIONS: Record<string, Permission> = {
  "/": PERMISSIONS.dashboardView,
  "/customers": PERMISSIONS.clientsView,
  "/orders": PERMISSIONS.pickupsView,
  "/invoices": PERMISSIONS.invoicesView,
  "/labels": PERMISSIONS.packagesView,
  "/label-updater": PERMISSIONS.packagesView,
  "/inventory": PERMISSIONS.inventoryView,
  "/items": PERMISSIONS.invoiceItemsView,
  "/containers": PERMISSIONS.containersView,
  "/routes": PERMISSIONS.routesView,
  "/route-assignments": PERMISSIONS.dispatchView,
  "/trucks": PERMISSIONS.trucksView,
  "/deliveries": PERMISSIONS.deliveriesView,
  "/accounting": PERMISSIONS.incomeView,
  "/reports": PERMISSIONS.reportsView,
  "/analytics": PERMISSIONS.reportsView,
  "/users": PERMISSIONS.usersView,
  "/roles": PERMISSIONS.rolesView,
  "/employees": PERMISSIONS.employeesView,
  "/employee-groups": PERMISSIONS.employeesView,
  "/security": PERMISSIONS.usersView,
  "/settings": PERMISSIONS.accountSettingsView,
};

export function permissionForPath(pathname: string): Permission | null {
  return PAGE_PERMISSIONS[pathname] ?? null;
}
