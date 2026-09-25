"use client";

import { ActiveRoutesDirectoryWorkspace } from "@/components/pickup-delivery-routes/pickup-delivery-routes-directory-workspace";
import { DeliveryRoutesSelectionActions } from "@/components/pickup-delivery-routes/delivery-routes-selection-actions";
import { PickupRoutesSelectionActions } from "@/components/pickup-delivery-routes/pickup-routes-selection-actions";
import { DAILY_ROUTES_DIRECTORY_VARIANT } from "@/lib/pickup-delivery-routes/directory-variant";
import { isDeliveryBranchCode } from "@/lib/pickup-delivery-routes/types";

/** NY (and other pickup branches) print appointments; RD/DR/DO print barcode delivery manifests. */
function isDeliveryRoutePrint(record: { routeType?: string; branch?: { code?: string } | null }) {
  return record.routeType === "delivery" || isDeliveryBranchCode(record.branch?.code);
}

export function DailyRoutesWorkspace() {
  return (
    <ActiveRoutesDirectoryWorkspace
      variant={DAILY_ROUTES_DIRECTORY_VARIANT}
      renderSelectionActions={({ activeRoutes, selectedIds }) => {
        const pickupIds = selectedIds.filter((id) =>
          activeRoutes.some((record) => record.id === id && !isDeliveryRoutePrint(record)),
        );
        const deliveryIds = selectedIds.filter((id) =>
          activeRoutes.some((record) => record.id === id && isDeliveryRoutePrint(record)),
        );

        return (
          <>
            {pickupIds.length > 0 ? (
              <PickupRoutesSelectionActions
                activeRoutes={activeRoutes}
                selectedIds={pickupIds}
                printDisabled={selectedIds.length !== 1}
              />
            ) : null}
            {deliveryIds.length > 0 ? (
              <DeliveryRoutesSelectionActions
                activeRoutes={activeRoutes}
                selectedIds={deliveryIds}
                printDisabled={selectedIds.length !== 1}
              />
            ) : null}
          </>
        );
      }}
    />
  );
}
