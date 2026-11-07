"use client";

import { useMemo } from "react";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useAppSelector } from "@/lib/store/hooks";
import {
  collectVehicleComplianceDue,
  vehicleComplianceToday,
  type VehicleComplianceDue,
} from "@/lib/vehicles/compliance-due";
import { useVehicleKpis } from "@/lib/vehicles/hooks/use-vehicles";

const NO_DUE: VehicleComplianceDue[] = [];

/**
 * Severe inspection/registration warnings for users who can open Vehicles:
 * active vehicles whose date is 7 days or fewer away (including overdue).
 * The API cannot filter by these dates yet, so this reads the shared fleet
 * snapshot; `isPartial` is true when the fleet exceeds that snapshot.
 */
export function useVehicleComplianceDue(options: { enabled?: boolean } = {}) {
  const { companyId, hasPermission, loading, roleLoading } = useAuth();
  const transport = useAppSelector((state) => state.auth);
  const canView = hasPermission(PERMISSIONS.vehiclesView.name, PERMISSIONS.vehiclesView.resourceType);
  const ready = !loading && !roleLoading && !!companyId && !!transport.idToken && transport.companyId === companyId;
  const enabled = (options.enabled ?? true) && ready && canView;

  const fleet = useVehicleKpis({ enabled });
  const today = vehicleComplianceToday();
  const items = useMemo(
    () => (enabled ? collectVehicleComplianceDue(fleet.items, today) : NO_DUE),
    [enabled, fleet.items, today],
  );

  return {
    companyId,
    today,
    items,
    isPartial: enabled && fleet.total > fleet.items.length,
    updatedAt: fleet.updatedAt,
  };
}
