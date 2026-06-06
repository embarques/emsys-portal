export type PermissionCatalogEntry = {
  value: string;
  label: string;
  group: string;
};

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  { group: "Customers", value: "customers.view", label: "View customers" },
  { group: "Customers", value: "customers.create", label: "Create customers" },
  { group: "Customers", value: "customers.edit", label: "Edit customers" },
  { group: "Customers", value: "customers.delete", label: "Delete customers" },
  { group: "Orders", value: "orders.view", label: "View orders" },
  { group: "Orders", value: "orders.create", label: "Create orders" },
  { group: "Orders", value: "orders.edit", label: "Edit orders" },
  { group: "Orders", value: "orders.delete", label: "Delete orders" },
  { group: "Invoices", value: "invoices.view", label: "View invoices" },
  { group: "Invoices", value: "invoices.create", label: "Create invoices" },
  { group: "Invoices", value: "invoices.edit", label: "Edit invoices" },
  { group: "Invoices", value: "invoices.delete", label: "Delete invoices" },
  { group: "Labels", value: "labels.view", label: "View labels" },
  { group: "Labels", value: "labels.create", label: "Create labels" },
  { group: "Labels", value: "labels.update", label: "Update labels" },
  { group: "Inventory", value: "inventory.view", label: "View inventory" },
  { group: "Inventory", value: "inventory.edit", label: "Edit inventory" },
  { group: "Routes", value: "routes.view", label: "View routes" },
  { group: "Routes", value: "routes.manage", label: "Manage routes" },
  { group: "Trucks", value: "trucks.view", label: "View trucks" },
  { group: "Trucks", value: "trucks.manage", label: "Manage trucks" },
  { group: "Employees", value: "employees.view", label: "View employees" },
  { group: "Employees", value: "employees.manage", label: "Manage employees" },
  { group: "Users", value: "users.view", label: "View users" },
  { group: "Users", value: "users.manage", label: "Manage users" },
  { group: "Roles", value: "roles.view", label: "View roles" },
  { group: "Roles", value: "roles.manage", label: "Manage roles" },
  { group: "Reports", value: "reports.view", label: "View reports" },
  { group: "Settings", value: "settings.view", label: "View settings" },
  { group: "Settings", value: "settings.manage", label: "Manage settings" },
];

export function getPermissionCatalogGroups(): string[] {
  return Array.from(new Set(PERMISSION_CATALOG.map((entry) => entry.group)));
}

export function getPermissionLabel(value: string): string {
  return PERMISSION_CATALOG.find((entry) => entry.value === value)?.label ?? value;
}

export function getPermissionsByGroup(group: string): PermissionCatalogEntry[] {
  return PERMISSION_CATALOG.filter((entry) => entry.group === group);
}
