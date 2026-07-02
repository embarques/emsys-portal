"use client";

import { ActiveRoutesDirectoryWorkspace } from "@/components/pickup-delivery-routes/pickup-delivery-routes-directory-workspace";
import { DELIVERY_ROUTES_DIRECTORY_VARIANT } from "@/lib/pickup-delivery-routes/directory-variant";

export function DeliveryRoutesWorkspace() {
  return <ActiveRoutesDirectoryWorkspace variant={DELIVERY_ROUTES_DIRECTORY_VARIANT} />;
}
