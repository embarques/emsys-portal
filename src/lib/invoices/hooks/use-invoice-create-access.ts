"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { resolveInvoiceCreateAccess } from "@/lib/invoices/utils/invoice-create-access";

/**
 * `canCreateInvoice` keeps the regular wizard. `canCreateAssignedInvoice`
 * alone gets the assigned flow: appointment-only, details auto-filled, parties locked.
 */
export function useInvoiceCreateAccess() {
  const { hasPermission, loading, roleLoading } = useAuth();

  return {
    /** False until permissions load — the two flows must not swap mid-form. */
    ready: !loading && !roleLoading,
    ...resolveInvoiceCreateAccess((permission) => hasPermission(permission.name, permission.resourceType)),
  };
}
