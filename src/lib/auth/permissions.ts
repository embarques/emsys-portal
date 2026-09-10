import type { Permission } from "@/lib/auth/types/permission";

/** Portal page gates — aligned with emsys-api permission seed where applicable. */
export const PERMISSIONS = {
  dashboardView: { name: "canViewSettings", resourceType: "settings" },
  clientsView: { name: "canViewCustomer", resourceType: "customer" },
  clientsCreate: { name: "canCreateCustomer", resourceType: "customer" },
  clientsUpdate: { name: "canUpdateCustomer", resourceType: "customer" },
  clientsDelete: { name: "canDeleteCustomer", resourceType: "customer" },
  pickupsView: { name: "canViewPickup", resourceType: "pickup" },
  pickupsViewAll: { name: "canViewAllPickups", resourceType: "pickup" },
  pickupsSyncLegacy: { name: "canSyncLegacyPickups", resourceType: "pickup" },
  /** Pickups submenu — API has no route/vehicle/dispatch seed; gate with pickup view. */
  routesView: { name: "canViewPickup", resourceType: "pickup" },
  vehiclesView: { name: "canViewPickup", resourceType: "pickup" },
  dispatchView: { name: "canViewPickup", resourceType: "pickup" },
  invoicesView: { name: "canViewInvoice", resourceType: "invoice" },
  invoicesSyncLegacy: { name: "canSyncLegacyInvoices", resourceType: "invoice" },
  /** Invoice items — no separate seed; gate with invoice view. */
  invoiceItemsView: { name: "canViewInvoice", resourceType: "invoice" },
  containersView: { name: "canViewContainer", resourceType: "container" },
  deliveriesView: { name: "canViewDelivery", resourceType: "delivery" },
  packagesView: { name: "canViewLabels", resourceType: "labels" },
  /**
   * Inventory — dedicated CRUD + list per resource. Until the API seeds these,
   * aliases still accept delivery/inventory view grants.
   */
  inventoryItemsList: { name: "canListInventoryItem", resourceType: "inventory_item" },
  inventoryItemsView: { name: "canViewInventoryItem", resourceType: "inventory_item" },
  inventoryItemsCreate: { name: "canCreateInventoryItem", resourceType: "inventory_item" },
  inventoryItemsUpdate: { name: "canUpdateInventoryItem", resourceType: "inventory_item" },
  inventoryItemsDelete: { name: "canDeleteInventoryItem", resourceType: "inventory_item" },
  inventoryStockList: { name: "canListInventoryStock", resourceType: "inventory_stock" },
  inventoryStockView: { name: "canViewInventoryStock", resourceType: "inventory_stock" },
  inventoryStockCreate: { name: "canCreateInventoryStock", resourceType: "inventory_stock" },
  inventoryStockUpdate: { name: "canUpdateInventoryStock", resourceType: "inventory_stock" },
  inventoryStockDelete: { name: "canDeleteInventoryStock", resourceType: "inventory_stock" },
  inventoryReceiptsList: { name: "canListInventoryReceipt", resourceType: "inventory_receipt" },
  inventoryReceiptsView: { name: "canViewInventoryReceipt", resourceType: "inventory_receipt" },
  inventoryReceiptsCreate: { name: "canCreateInventoryReceipt", resourceType: "inventory_receipt" },
  inventoryReceiptsUpdate: { name: "canUpdateInventoryReceipt", resourceType: "inventory_receipt" },
  inventoryReceiptsDelete: { name: "canDeleteInventoryReceipt", resourceType: "inventory_receipt" },
  inventoryDispatchesList: { name: "canListInventoryDispatch", resourceType: "inventory_dispatch" },
  inventoryDispatchesView: { name: "canViewInventoryDispatch", resourceType: "inventory_dispatch" },
  inventoryDispatchesCreate: { name: "canCreateInventoryDispatch", resourceType: "inventory_dispatch" },
  inventoryDispatchesUpdate: { name: "canUpdateInventoryDispatch", resourceType: "inventory_dispatch" },
  inventoryDispatchesDelete: { name: "canDeleteInventoryDispatch", resourceType: "inventory_dispatch" },
  inventorySuppliersList: { name: "canListInventorySupplier", resourceType: "inventory_supplier" },
  inventorySuppliersView: { name: "canViewInventorySupplier", resourceType: "inventory_supplier" },
  inventorySuppliersCreate: { name: "canCreateInventorySupplier", resourceType: "inventory_supplier" },
  inventorySuppliersUpdate: { name: "canUpdateInventorySupplier", resourceType: "inventory_supplier" },
  inventorySuppliersDelete: { name: "canDeleteInventorySupplier", resourceType: "inventory_supplier" },
  /** Parent inventory route — list stock until a dedicated inventory permission exists. */
  inventoryView: { name: "canListInventoryStock", resourceType: "inventory_stock" },
  incomeView: { name: "canViewIncomeStatement", resourceType: "income_statement" },
  /** Checks CRUD + list. Income view still grants these until the API seeds check permissions. */
  checksList: { name: "canListCheck", resourceType: "check" },
  checksView: { name: "canViewCheck", resourceType: "check" },
  checksCreate: { name: "canCreateCheck", resourceType: "check" },
  checksUpdate: { name: "canUpdateCheck", resourceType: "check" },
  checksDelete: { name: "canDeleteCheck", resourceType: "check" },
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

const INVENTORY_CRUD_PERMISSIONS: Permission[] = [
  PERMISSIONS.inventoryItemsList,
  PERMISSIONS.inventoryItemsView,
  PERMISSIONS.inventoryItemsCreate,
  PERMISSIONS.inventoryItemsUpdate,
  PERMISSIONS.inventoryItemsDelete,
  PERMISSIONS.inventoryStockList,
  PERMISSIONS.inventoryStockView,
  PERMISSIONS.inventoryStockCreate,
  PERMISSIONS.inventoryStockUpdate,
  PERMISSIONS.inventoryStockDelete,
  PERMISSIONS.inventoryReceiptsList,
  PERMISSIONS.inventoryReceiptsView,
  PERMISSIONS.inventoryReceiptsCreate,
  PERMISSIONS.inventoryReceiptsUpdate,
  PERMISSIONS.inventoryReceiptsDelete,
  PERMISSIONS.inventoryDispatchesList,
  PERMISSIONS.inventoryDispatchesView,
  PERMISSIONS.inventoryDispatchesCreate,
  PERMISSIONS.inventoryDispatchesUpdate,
  PERMISSIONS.inventoryDispatchesDelete,
  PERMISSIONS.inventorySuppliersList,
  PERMISSIONS.inventorySuppliersView,
  PERMISSIONS.inventorySuppliersCreate,
  PERMISSIONS.inventorySuppliersUpdate,
  PERMISSIONS.inventorySuppliersDelete,
];

const INVENTORY_LEGACY_GRANTS = ["delivery:canviewdelivery", "inventory:canviewinventory"] as const;
const INVENTORY_LEGACY_VIEW_NAMES = ["canviewdelivery", "canviewinventory"] as const;

const INVENTORY_GRANT_ALIASES: Record<string, readonly string[]> = Object.fromEntries(
  INVENTORY_CRUD_PERMISSIONS.map((permission) => [permissionKey(permission), INVENTORY_LEGACY_GRANTS]),
);

const INVENTORY_VIEW_NAME_ALIASES: Record<string, readonly string[]> = Object.fromEntries(
  INVENTORY_CRUD_PERMISSIONS.map((permission) => [
    permission.name.toLowerCase(),
    INVENTORY_LEGACY_VIEW_NAMES,
  ]),
);

/**
 * Legacy or alternate API grants that still satisfy a portal permission check.
 * Keys use permissionKey() of the portal-required permission.
 */
const PERMISSION_GRANT_ALIASES: Record<string, readonly string[]> = {
  ...INVENTORY_GRANT_ALIASES,
  "settings:canviewsettings": ["settings:canviewdashboard", "dashboard:canviewdashboard"],
  "customer:canviewcustomer": ["client:canviewclient"],
  "customer:cancreatecustomer": ["client:cancreateclient"],
  "customer:canupdatecustomer": ["client:canupdateclient"],
  "customer:candeletecustomer": ["client:candeleteclient"],
  "income_statement:canviewincomestatement": ["income:canviewincome"],
  "check:canlistcheck": [
    "income_statement:canviewincomestatement",
    "income:canviewincome",
  ],
  "check:canviewcheck": [
    "income_statement:canviewincomestatement",
    "income:canviewincome",
  ],
  "check:cancreatecheck": [
    "income_statement:canviewincomestatement",
    "income:canviewincome",
  ],
  "check:canupdatecheck": [
    "income_statement:canviewincomestatement",
    "income:canviewincome",
  ],
  "check:candeletecheck": [
    "income_statement:canviewincomestatement",
    "income:canviewincome",
  ],
  "chart_account:canviewchartaccount": ["account:canviewaccount"],
  "pickup:canviewpickup": [
    "route:canviewroute",
    "vehicle:canviewvehicle",
    "dispatch:canviewdispatch",
  ],
  "invoice:canviewinvoice": ["invoiceitem:canviewinvoiceitem"],
  "delivery:canviewdelivery": ["inventory:canviewinventory"],
  "user:canviewuser": ["role:canviewrole"],
  "branch:canviewbranch": ["settings:canviewsettings"],
};

/** Permission names that satisfy a required view when resource types differ in legacy data. */
const VIEW_NAME_ALIASES: Record<string, readonly string[]> = {
  canviewsettings: ["canviewdashboard", "canviewsettings"],
  canviewcustomer: ["canviewclient", "canviewcustomer"],
  cancreatecustomer: ["cancreateclient", "cancreatecustomer"],
  canupdatecustomer: ["canupdateclient", "canupdatecustomer"],
  candeletecustomer: ["candeleteclient", "candeletecustomer"],
  canviewincomestatement: ["canviewincome", "canviewincomestatement"],
  canlistcheck: ["canviewincomestatement", "canviewincome", "canlistchecks"],
  canviewcheck: ["canviewincomestatement", "canviewincome", "canviewchecks"],
  cancreatecheck: ["canviewincomestatement", "canviewincome", "cancreatechecks"],
  canupdatecheck: ["canviewincomestatement", "canviewincome", "canupdatechecks"],
  candeletecheck: ["canviewincomestatement", "canviewincome", "candeletechecks"],
  canviewchartaccount: ["canviewaccount", "canviewchartaccount"],
  canviewpickup: ["canviewroute", "canviewvehicle", "canviewdispatch"],
  canviewinvoice: ["canviewinvoiceitem"],
  ...INVENTORY_VIEW_NAME_ALIASES,
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
