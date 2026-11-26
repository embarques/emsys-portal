"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";

/** Assignment scope is enforced by the pickups API, including for mixed grants. */
export function useRouteAppointmentsAccess() {
  const { hasPermission, companyId, user, email, permissions } = useAuth();
  const canViewAll = permissions.some((p) => p.name === PERMISSIONS.pickupsView.name && p.resourceType === PERMISSIONS.pickupsView.resourceType);
  const canUpdate = hasPermission("canUpdatePickup", "pickup")
    || hasPermission(PERMISSIONS.routeAppointmentsUpdate.name, PERMISSIONS.routeAppointmentsUpdate.resourceType);
  return {
    scopeKey: JSON.stringify([companyId, user?.uid || email || "", canViewAll, canUpdate]),
    canViewAll,
    canView: canViewAll || hasPermission(PERMISSIONS.routeAppointmentsView.name, PERMISSIONS.routeAppointmentsView.resourceType),
    canUpdate,
  };
}
