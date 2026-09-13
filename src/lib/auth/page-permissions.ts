import { PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";

/** Maps portal routes to EMSYS API permissions (adapted from emsys-portal_v2). */
export const PAGE_PERMISSIONS: Record<string, Permission> = {
  "/": PERMISSIONS.dashboardView,
  "/customers": PERMISSIONS.clientsView,
  "/appointments": PERMISSIONS.pickupsView,
  "/appointments/map": PERMISSIONS.pickupsView,
  "/invoices": PERMISSIONS.invoicesView,
  "/barcodes": PERMISSIONS.packagesView,
  "/label-updater": PERMISSIONS.packagesView,
  "/inventory": PERMISSIONS.inventoryStockList,
  "/inventory/items": PERMISSIONS.inventoryStockList,
  "/inventory/receipts": PERMISSIONS.inventoryReceiptsList,
  "/inventory/dispatches": PERMISSIONS.inventoryDispatchesList,
  "/inventory/suppliers": PERMISSIONS.inventorySuppliersList,
  "/inventory/recipients": PERMISSIONS.inventoryStockList,
  "/items": PERMISSIONS.invoiceItemsView,
  "/containers": PERMISSIONS.containersView,
  "/routes": PERMISSIONS.dispatchView,
  "/daily-routes": PERMISSIONS.dispatchView,
  "/pickup-routes": PERMISSIONS.dispatchView,
  "/appointment-routes": PERMISSIONS.dispatchView,
  "/delivery-routes": PERMISSIONS.dispatchView,
  "/vehicles": PERMISSIONS.vehiclesView,
  "/accounting": PERMISSIONS.incomeView,
  "/accounting/checks": PERMISSIONS.checksList,
  "/reports": PERMISSIONS.reportsView,
  "/analytics": PERMISSIONS.reportsView,
  "/users": PERMISSIONS.usersView,
  "/roles": PERMISSIONS.rolesView,
  "/employees": PERMISSIONS.employeesView,
  "/settings": PERMISSIONS.accountSettingsView,
  "/branches": PERMISSIONS.branchesView,
  "/barcode-statuses": PERMISSIONS.barcodeStatusesView,
};

export function permissionForPath(pathname: string): Permission | null {
  return PAGE_PERMISSIONS[pathname] ?? null;
}
