"use client";

import { ActiveRoutesDirectoryWorkspace } from "@/components/pickup-delivery-routes/pickup-delivery-routes-directory-workspace";
import { PICKUP_ROUTES_DIRECTORY_VARIANT } from "@/lib/pickup-delivery-routes/directory-variant";

export function PickupRoutesWorkspace() {
  return <ActiveRoutesDirectoryWorkspace variant={PICKUP_ROUTES_DIRECTORY_VARIANT} />;
}
