import type { ComponentType } from "react";

import { AnalyticsWorkspace, ReportsWorkspace, SecurityWorkspace } from "@/components/insights/insights-workspaces";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { DailyIncomeWorkspace } from "@/components/accounting/daily-income-workspace";
import { ChartOfAccountsWorkspace } from "@/components/accounting/chart-of-accounts-workspace";
import { BranchesWorkspace } from "@/components/branches/branches-workspace";
import { ConfigurationWorkspace } from "@/components/configuration/configuration-workspace";
import { ContainersWorkspace } from "@/components/containers/containers-workspace";
import { CustomersWorkspace } from "@/components/customers/customers-workspace";
import { EmployeeGroupsWorkspace } from "@/components/employee-groups/employee-groups-workspace";
import { EmployeesWorkspace } from "@/components/employees/employees-workspace";
import { InventoryWorkspace } from "@/components/inventory/inventory-workspace";
import { InvoicesWorkspace } from "@/components/invoices/invoices-workspace";
import { ItemsWorkspace } from "@/components/items/items-workspace";
import { LabelUpdaterWorkspace } from "@/components/label-updater/label-updater-workspace";
import { OrdersWorkspace } from "@/components/orders/orders-workspace";
import { RolesWorkspace } from "@/components/roles/roles-workspace";
import { RouteAssignmentsWorkspace } from "@/components/route-assignments/route-assignments-workspace";
import { UsersWorkspace } from "@/components/users/users-workspace";
import { VehiclesWorkspace } from "@/components/vehicles/vehicles-workspace";
import { navigation } from "@/config/navigation";

/** Maps dashboard routes to the client workspace component rendered inside a tab. */
export const workspaceRegistry: Record<string, ComponentType> = {
  "/": DashboardWorkspace,
  "/customers": CustomersWorkspace,
  "/orders": OrdersWorkspace,
  "/invoices": InvoicesWorkspace,
  "/label-updater": LabelUpdaterWorkspace,
  "/inventory": InventoryWorkspace,
  "/items": ItemsWorkspace,
  "/containers": ContainersWorkspace,
  "/routes": RouteAssignmentsWorkspace,
  "/vehicles": VehiclesWorkspace,
  "/accounting/daily-income": DailyIncomeWorkspace,
  "/accounting/accounts": ChartOfAccountsWorkspace,
  "/reports": ReportsWorkspace,
  "/analytics": AnalyticsWorkspace,
  "/users": UsersWorkspace,
  "/roles": RolesWorkspace,
  "/employees": EmployeesWorkspace,
  "/employee-groups": EmployeeGroupsWorkspace,
  "/security": SecurityWorkspace,
  "/branches": BranchesWorkspace,
  "/settings": ConfigurationWorkspace,
};

export function isWorkspaceRoute(href: string): boolean {
  const pathname = href.split("?")[0] ?? href;
  return pathname in workspaceRegistry;
}

export function resolveWorkspaceLabel(href: string, fallback?: string): string {
  const pathname = href.split("?")[0] ?? href;
  const navItem = navigation.flatMap((group) => group.items).find((item) => item.href === pathname);
  return fallback ?? navItem?.label ?? (pathname.replace(/^\//, "") || "Page");
}

export function resolveWorkspaceComponent(href: string): ComponentType | null {
  const pathname = href.split("?")[0] ?? href;
  return workspaceRegistry[pathname] ?? null;
}
