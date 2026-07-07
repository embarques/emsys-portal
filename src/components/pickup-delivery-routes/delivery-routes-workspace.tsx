"use client";

import { ActiveRoutesDirectoryWorkspace } from "@/components/pickup-delivery-routes/pickup-delivery-routes-directory-workspace";
import { DeliveryRoutesSelectionActions } from "@/components/pickup-delivery-routes/delivery-routes-selection-actions";
import { DELIVERY_ROUTES_DIRECTORY_VARIANT } from "@/lib/pickup-delivery-routes/directory-variant";

export function DeliveryRoutesWorkspace() {
  return (
    <ActiveRoutesDirectoryWorkspace
      variant={DELIVERY_ROUTES_DIRECTORY_VARIANT}
      showRecordIdColumn
      renderSelectionActions={({ activeRoutes, selectedIds }) => (
        <DeliveryRoutesSelectionActions
          activeRoutes={activeRoutes}
          selectedIds={selectedIds}
        />
      )}
    />
  );
}
