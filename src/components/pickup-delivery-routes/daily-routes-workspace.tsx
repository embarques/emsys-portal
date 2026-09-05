"use client";

import { ActiveRoutesDirectoryWorkspace } from "@/components/pickup-delivery-routes/pickup-delivery-routes-directory-workspace";
import { DeliveryRoutesSelectionActions } from "@/components/pickup-delivery-routes/delivery-routes-selection-actions";
import { PickupRoutesSelectionActions } from "@/components/pickup-delivery-routes/pickup-routes-selection-actions";
import { DAILY_ROUTES_DIRECTORY_VARIANT } from "@/lib/pickup-delivery-routes/directory-variant";

export function DailyRoutesWorkspace() {
  return (
    <ActiveRoutesDirectoryWorkspace
      variant={DAILY_ROUTES_DIRECTORY_VARIANT}
      renderSelectionActions={({ activeRoutes, selectedIds }) => {
        const pickupIds = selectedIds.filter((id) =>
          activeRoutes.some((record) => record.id === id && record.routeType !== "delivery"),
        );
        const deliveryIds = selectedIds.filter((id) =>
          activeRoutes.some((record) => record.id === id && record.routeType === "delivery"),
        );

        return (
          <>
            {pickupIds.length > 0 ? (
              <PickupRoutesSelectionActions activeRoutes={activeRoutes} selectedIds={pickupIds} />
            ) : null}
            {deliveryIds.length > 0 ? (
              <DeliveryRoutesSelectionActions
                activeRoutes={activeRoutes}
                selectedIds={deliveryIds}
              />
            ) : null}
          </>
        );
      }}
    />
  );
}
