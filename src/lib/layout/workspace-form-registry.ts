import type { ComponentType } from "react";

import { BarcodeFormWorkspace } from "@/components/barcodes/barcode-form-workspace";
import { BranchFormWorkspace } from "@/components/branches/branch-form-workspace";
import { ContainerFormWorkspace } from "@/components/containers/container-form-workspace";
import { CustomerFormWorkspace } from "@/components/customers/customer-form-workspace";
import { EmployeeFormWorkspace } from "@/components/employees/employee-form-workspace";
import { InvoiceDocumentsWorkspace } from "@/components/invoices/invoice-documents-workspace";
import { InvoiceFormWorkspace } from "@/components/invoices/invoice-form-workspace";
import { ItemFormWorkspace } from "@/components/items/item-form-workspace";
import { OrderFormWorkspace } from "@/components/orders/order-form-workspace";
import { RoleFormWorkspace } from "@/components/roles/role-form-workspace";
import {
  DailyRouteFormWorkspace,
  PickupRouteFormWorkspace,
} from "@/components/pickup-delivery-routes/pickup-delivery-route-form-workspace";
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
  /** Preset/locked customer type when the form was opened with one (customers add). */
  customerType?: number;
  customerFormIntent?: "address" | "phone";
  /** Focus an existing customer address instead of the name field. */
  focusAddressIndex?: number;
  /** Invoice wizard step to open on when deep-linking from another workspace. */
  initialWizardStep?: number;
  /** Prefer focusing the line item that owns this barcode id/number. */
  focusBarcodeId?: string;
  /** New invoice started from an appointment. */
  invoicePrefill?: WorkspaceTabForm["invoicePrefill"];
  /** Remount token when re-opening an existing form tab at a new step. */
  formNonce?: number;
  /** Close after a successful add and hand the created id back to the opener. */
  closeOnSave?: boolean;
};

/** Maps a feature key to the form host component rendered inside a form tab. */
export const workspaceFormRegistry: Record<string, ComponentType<WorkspaceFormHostProps>> = {
  barcodes: BarcodeFormWorkspace,
  customers: CustomerFormWorkspace,
  orders: OrderFormWorkspace,
  invoices: InvoiceFormWorkspace,
  "invoice-documents": InvoiceDocumentsWorkspace,
  items: ItemFormWorkspace,
  containers: ContainerFormWorkspace,
  "routes": RouteFormWorkspace,
  "daily-routes": DailyRouteFormWorkspace,
  "pickup-routes": PickupRouteFormWorkspace,
  "delivery-routes": DailyRouteFormWorkspace,
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
