"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { Permission } from "@/lib/auth/types/permission";
import { useAppSelector } from "@/lib/store/hooks";
import type { Barcode } from "@/lib/barcodes/types";

export type DeliverTarget = Pick<Barcode, "invoiceId" | "barcodeId" | "number" | "route" | "delivery"> & {
  /** Daily route exchange rate when the list row already carries it. */
  routeRate?: number;
};

export function useDeliveryAccess() {
  const { hasPermission, isAuthenticated, user, email } = useAuth();
  const companyId = useAppSelector((state) => state.auth.companyId);
  const has = (permission: Permission) => hasPermission(permission.name, permission.resourceType);
  const session = isAuthenticated && Boolean(companyId);
  return {
    companyId,
    actorId: user?.uid || email || "",
    canPrint: session && has(PERMISSIONS.invoicesPrint),
    canList: session && has(PERMISSIONS.deliveriesView),
    // Status changes and delivery documents are written on the invoice.
    canDeliver: session
      && has(PERMISSIONS.deliveriesUpdate)
      && has(PERMISSIONS.invoicesView)
      && has(PERMISSIONS.invoicesUpdate),
  };
}
