"use client";

import { ActiveRoutesDirectoryWorkspace } from "@/components/pickup-delivery-routes/pickup-delivery-routes-directory-workspace";
import { PickupRoutesSelectionActions } from "@/components/pickup-delivery-routes/pickup-routes-selection-actions";
import { PICKUP_ROUTES_DIRECTORY_VARIANT } from "@/lib/pickup-delivery-routes/directory-variant";

export function PickupRoutesWorkspace() {
  return (
    <ActiveRoutesDirectoryWorkspace
      variant={PICKUP_ROUTES_DIRECTORY_VARIANT}
      renderSelectionActions={({ activeRoutes, selectedIds }) => (
        <PickupRoutesSelectionActions activeRoutes={activeRoutes} selectedIds={selectedIds} />
      )}
    />
  );
}
