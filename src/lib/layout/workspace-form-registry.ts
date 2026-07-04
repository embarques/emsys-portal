import type { ComponentType } from "react";

import { BranchFormWorkspace } from "@/components/branches/branch-form-workspace";
import { ContainerFormWorkspace } from "@/components/containers/container-form-workspace";
import { CustomerFormWorkspace } from "@/components/customers/customer-form-workspace";
import { EmployeeFormWorkspace } from "@/components/employees/employee-form-workspace";
import { InvoiceFormWorkspace } from "@/components/invoices/invoice-form-workspace";
import { ItemFormWorkspace } from "@/components/items/item-form-workspace";
import { OrderFormWorkspace } from "@/components/orders/order-form-workspace";
import { RoleFormWorkspace } from "@/components/roles/role-form-workspace";
import { DeliveryRouteFormWorkspace, PickupRouteFormWorkspace } from "@/components/pickup-delivery-routes/pickup-delivery-route-form-workspace";
import { RouteFormWorkspace } from "@/components/route-manager/route-form-workspace";
import { UserFormWorkspace } from "@/components/users/user-form-workspace";
import { VehicleFormWorkspace } from "@/components/vehicles/vehicle-form-workspace";
import { DailyIncomeTransactionFormWorkspace } from "@/components/accounting/daily-income-transaction-form-workspace";
import type { WorkspaceTabForm } from "@/lib/layout/workspace-tab-types";

/** Props every add/edit form host component rendered inside a workspace tab receives. */
export type WorkspaceFormHostProps = {
  /** Id of the tab hosting this form (used to close/return). */
  tabId: string;
  mode: WorkspaceTabForm["mode"];
  /** Target record id when editing. */
  entityId?: string;
};

/** Maps a feature key to the form host component rendered inside a form tab. */
export const workspaceFormRegistry: Record<string, ComponentType<WorkspaceFormHostProps>> = {
  customers: CustomerFormWorkspace,
  orders: OrderFormWorkspace,
  invoices: InvoiceFormWorkspace,
  items: ItemFormWorkspace,
  containers: ContainerFormWorkspace,
  "routes": RouteFormWorkspace,
  "pickup-routes": PickupRouteFormWorkspace,
  "delivery-routes": DeliveryRouteFormWorkspace,
  roles: RoleFormWorkspace,
  vehicles: VehicleFormWorkspace,
  users: UserFormWorkspace,
  employees: EmployeeFormWorkspace,
  branches: BranchFormWorkspace,
  "daily-income-transactions": DailyIncomeTransactionFormWorkspace,
};

export function resolveWorkspaceFormComponent(
  feature: string,
): ComponentType<WorkspaceFormHostProps> | null {
  return workspaceFormRegistry[feature] ?? null;
}
