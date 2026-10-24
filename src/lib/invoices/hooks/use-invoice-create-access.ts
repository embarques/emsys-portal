"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";

/**
 * Full invoice access keeps the regular wizard. `canCreateAssignedInvoice`
 * alone gets the assigned flow: appointment-only, details auto-filled, parties locked.
 */
export function useInvoiceCreateAccess() {
  const { hasPermission, loading, roleLoading } = useAuth();
  const hasFullAccess = hasPermission(
    PERMISSIONS.invoicesView.name,
    PERMISSIONS.invoicesView.resourceType,
  );
  const canCreateAssigned = hasPermission(
    PERMISSIONS.invoicesCreateAssigned.name,
    PERMISSIONS.invoicesCreateAssigned.resourceType,
  );

  return {
    /** False until permissions load — the two flows must not swap mid-form. */
    ready: !loading && !roleLoading,
    canCreateFromAppointment: hasFullAccess || canCreateAssigned,
    isAssignedOnly: !hasFullAccess && canCreateAssigned,
  };
}
