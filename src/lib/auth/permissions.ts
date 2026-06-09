import type { Permission } from "@/lib/auth/types/permission";

/** Portal page gates — aligned with emsys-api permission seed where applicable. */
export const PERMISSIONS = {
  dashboardView: { name: "canViewSettings", resourceType: "settings" },
  clientsView: { name: "canViewCustomer", resourceType: "customer" },
  pickupsView: { name: "canViewPickup", resourceType: "pickup" },
  /** Pickups submenu — API has no route/truck/dispatch seed; gate with pickup view. */
  routesView: { name: "canViewPickup", resourceType: "pickup" },
  trucksView: { name: "canViewPickup", resourceType: "pickup" },
  dispatchView: { name: "canViewPickup", resourceType: "pickup" },
  invoicesView: { name: "canViewInvoice", resourceType: "invoice" },
  /** Invoice items — no separate seed; gate with invoice view. */
  invoiceItemsView: { name: "canViewInvoice", resourceType: "invoice" },
  containersView: { name: "canViewContainer", resourceType: "container" },
  deliveriesView: { name: "canViewDelivery", resourceType: "delivery" },
  packagesView: { name: "canViewLabels", resourceType: "labels" },
  /** Inventory — no seed; gate with delivery view until API adds inventory. */
  inventoryView: { name: "canViewDelivery", resourceType: "delivery" },
  incomeView: { name: "canViewIncomeStatement", resourceType: "income_statement" },
  accountsView: { name: "canViewChartAccount", resourceType: "chart_account" },
  reportsView: { name: "canViewReport", resourceType: "report" },
  usersView: { name: "canViewUser", resourceType: "user" },
  /** Roles UI — no seed; gate with user view until API adds role permissions. */
  rolesView: { name: "canViewUser", resourceType: "user" },
  employeesView: { name: "canViewEmployee", resourceType: "employee" },
  accountSettingsView: { name: "canViewSettings", resourceType: "settings" },
  branchesView: { name: "canViewBranch", resourceType: "branch" },
} satisfies Record<string, Permission>;

export function permissionKey(permission: Permission): string {
  return `${permission.resourceType}:${permission.name}`.toLowerCase();
}

/**
 * Legacy or alternate API grants that still satisfy a portal permission check.
 * Keys use permissionKey() of the portal-required permission.
 */
const PERMISSION_GRANT_ALIASES: Record<string, readonly string[]> = {
  "settings:canviewsettings": ["settings:canviewdashboard", "dashboard:canviewdashboard"],
  "customer:canviewcustomer": ["client:canviewclient"],
  "income_statement:canviewincomestatement": ["income:canviewincome"],
  "chart_account:canviewchartaccount": ["account:canviewaccount"],
  "pickup:canviewpickup": ["route:canviewroute", "truck:canviewtruck", "dispatch:canviewdispatch"],
  "invoice:canviewinvoice": ["invoiceitem:canviewinvoiceitem"],
  "delivery:canviewdelivery": ["inventory:canviewinventory"],
  "user:canviewuser": ["role:canviewrole"],
  "branch:canviewbranch": ["settings:canviewsettings"],
};

/** Permission names that satisfy a required view when resource types differ in legacy data. */
const VIEW_NAME_ALIASES: Record<string, readonly string[]> = {
  canviewsettings: ["canviewdashboard", "canviewsettings"],
  canviewcustomer: ["canviewclient", "canviewcustomer"],
  canviewincomestatement: ["canviewincome", "canviewincomestatement"],
  canviewchartaccount: ["canviewaccount", "canviewchartaccount"],
  canviewpickup: ["canviewroute", "canviewtruck", "canviewdispatch"],
  canviewinvoice: ["canviewinvoiceitem"],
  canviewdelivery: ["canviewinventory"],
  canviewuser: ["canviewrole"],
  canviewbranch: ["canviewsettings", "canviewbranch"],
};

function grantedByViewName(requiredName: string, grantedKeys: ReadonlySet<string>): boolean {
  const required = requiredName.toLowerCase();
  const accepted = new Set([required, ...(VIEW_NAME_ALIASES[required] ?? [])]);

  for (const key of Array.from(grantedKeys)) {
    const name = key.split(":").pop();
    if (name && accepted.has(name)) return true;
  }

  return false;
}

export function permissionIsGranted(
  required: Permission,
  grantedKeys: ReadonlySet<string>,
): boolean {
  if (grantedKeys.has("*:*")) return true;

  const requiredKey = permissionKey(required);
  if (grantedKeys.has(requiredKey)) return true;

  const aliases = PERMISSION_GRANT_ALIASES[requiredKey];
  if (aliases?.some((key) => grantedKeys.has(key))) return true;

  return grantedByViewName(required.name, grantedKeys);
}
