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
import { OrdersMapWorkspace } from "@/components/orders/orders-map-workspace";
import { RolesWorkspace } from "@/components/roles/roles-workspace";
import { RouteManagerWorkspace } from "@/components/route-manager/route-manager-workspace";
import { PickupRoutesWorkspace } from "@/components/pickup-delivery-routes/pickup-routes-workspace";
import { DeliveryRoutesWorkspace } from "@/components/pickup-delivery-routes/delivery-routes-workspace";
import { UsersWorkspace } from "@/components/users/users-workspace";
import { VehiclesWorkspace } from "@/components/vehicles/vehicles-workspace";
import { navigation, topNavigationItems } from "@/config/navigation";
import type { WorkspaceTab } from "@/lib/layout/workspace-tab-types";
import { findNavigationItemByHref, flattenAllNavigationItems } from "@/lib/navigation/nav-utils";
import { translate, type Locale } from "@/lib/i18n/catalog";

/** Maps dashboard routes to the client workspace component rendered inside a tab. */
export const workspaceRegistry: Record<string, ComponentType> = {
  "/": DashboardWorkspace,
  "/customers": CustomersWorkspace,
  "/orders": OrdersWorkspace,
  "/orders/map": OrdersMapWorkspace,
  "/invoices": InvoicesWorkspace,
  "/label-updater": LabelUpdaterWorkspace,
  "/inventory": InventoryWorkspace,
  "/items": ItemsWorkspace,
  "/containers": ContainersWorkspace,
  "/routes": RouteManagerWorkspace,
  "/pickup-routes": PickupRoutesWorkspace,
  "/delivery-routes": DeliveryRoutesWorkspace,
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
  const navItem = findNavigationItemByHref(flattenAllNavigationItems(navigation, topNavigationItems), pathname);
  return navItem?.labelKey ?? null;
}

export function resolveWorkspaceLabel(href: string, locale: Locale = "en", fallback?: string): string {
  const pathname = href.split("?")[0] ?? href;
  const labelKey = resolveWorkspaceNavLabelKey(href);
  if (labelKey) return translate(locale, labelKey);
  return fallback ?? (pathname.replace(/^\//, "") || translate(locale, "shell.pageFallback"));
}

export function getWorkspaceTabDisplayLabel(
  tab: Pick<WorkspaceTab, "href" | "label" | "form">,
  locale: Locale,
): string {
  // Add/edit form tabs set an explicit label at open time (e.g. "Add customer", "Edit Acme Corp").
  if (tab.form) return tab.label;

  const labelKey = resolveWorkspaceNavLabelKey(tab.href);
  if (labelKey) return translate(locale, labelKey);
  return tab.label;
}

export function resolveWorkspaceComponent(href: string): ComponentType | null {
  const pathname = href.split("?")[0] ?? href;
  return workspaceRegistry[pathname] ?? null;
}
