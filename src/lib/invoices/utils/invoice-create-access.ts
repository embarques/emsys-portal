import { PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";

export type InvoiceCreateAccess = {
  /** Full invoice wizard (Invoices → Add invoice, quick action, appointments). */
  canCreate: boolean;
  canCreateFromAppointment: boolean;
  /** Assigned-work flow: appointment-only, details auto-filled, parties locked. */
  isAssignedOnly: boolean;
  /** Form tabs may live under `/invoices`; otherwise they stay under `/appointments`. */
  canOpenInvoices: boolean;
};

export function resolveInvoiceCreateAccess(granted: (permission: Permission) => boolean): InvoiceCreateAccess {
  const canCreate = granted(PERMISSIONS.invoicesCreate);
  const canCreateAssigned = granted(PERMISSIONS.invoicesCreateAssigned);

  return {
    canCreate,
    canCreateFromAppointment: canCreate || canCreateAssigned,
    isAssignedOnly: !canCreate && canCreateAssigned,
    canOpenInvoices: granted(PERMISSIONS.invoicesView),
  };
}
