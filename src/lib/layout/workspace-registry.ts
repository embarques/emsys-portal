import type { ComponentType } from "react";

import { AnalyticsWorkspace, ReportsWorkspace, SecurityWorkspace } from "@/components/insights/insights-workspaces";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import { DailyIncomeWorkspace } from "@/components/accounting/daily-income-workspace";
import { ChartOfAccountsWorkspace } from "@/components/accounting/chart-of-accounts-workspace";
import { BranchesWorkspace } from "@/components/branches/branches-workspace";
import { ConfigurationWorkspace } from "@/components/configuration/configuration-workspace";
import { ContainersWorkspace } from "@/components/containers/containers-workspace";
import { CustomersWorkspace } from "@/components/customers/customers-workspace";
import { EmployeesWorkspace } from "@/components/employees/employees-workspace";
import { InventoryWorkspace } from "@/components/inventory/inventory-workspace";
import { InvoicesWorkspace } from "@/components/invoices/invoices-workspace";
import { ItemsWorkspace } from "@/components/items/items-workspace";
import { LabelUpdaterWorkspace } from "@/components/label-updater/label-updater-workspace";
import { OrdersWorkspace } from "@/components/orders/orders-workspace";
import { RolesWorkspace } from "@/components/roles/roles-workspace";
import { RoutesWorkspace } from "@/components/routes/routes-workspace";
import { UsersWorkspace } from "@/components/users/users-workspace";
import { VehiclesWorkspace } from "@/components/vehicles/vehicles-workspace";
import { navigation } from "@/config/navigation";
import type { WorkspaceTab } from "@/lib/layout/workspace-tab-types";
import { translate, type Locale } from "@/lib/i18n/catalog";

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
  "/routes": RoutesWorkspace,
  "/vehicles": VehiclesWorkspace,
  "/accounting/daily-income": DailyIncomeWorkspace,
  "/accounting/accounts": ChartOfAccountsWorkspace,
  "/reports": ReportsWorkspace,
  "/analytics": AnalyticsWorkspace,
  "/users": UsersWorkspace,
  "/roles": RolesWorkspace,
  "/employees": EmployeesWorkspace,
  "/security": SecurityWorkspace,
  "/branches": BranchesWorkspace,
  "/settings": ConfigurationWorkspace,
};

export function isWorkspaceRoute(href: string): boolean {
  const pathname = href.split("?")[0] ?? href;
  return pathname in workspaceRegistry;
}

export function resolveWorkspaceNavLabelKey(href: string): string | null {
  const pathname = href.split("?")[0] ?? href;
  const navItem = navigation.flatMap((group) => group.items).find((item) => item.href === pathname);
  return navItem?.labelKey ?? null;
}

export function resolveWorkspaceLabel(href: string, locale: Locale = "en", fallback?: string): string {
  const pathname = href.split("?")[0] ?? href;
  const labelKey = resolveWorkspaceNavLabelKey(href);
  if (labelKey) return translate(locale, labelKey);
  return fallback ?? (pathname.replace(/^\//, "") || translate(locale, "shell.pageFallback"));
}

export function getWorkspaceTabDisplayLabel(tab: Pick<WorkspaceTab, "href" | "label">, locale: Locale): string {
  const labelKey = resolveWorkspaceNavLabelKey(tab.href);
  if (labelKey) return translate(locale, labelKey);
  return tab.label;
}

export function resolveWorkspaceComponent(href: string): ComponentType | null {
  const pathname = href.split("?")[0] ?? href;
  return workspaceRegistry[pathname] ?? null;
}
