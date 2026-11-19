"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS, permissionKey } from "@/lib/auth/permissions";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { fetchPaymentInvoiceReference } from "./payment-invoice";
import { useAccountingQueryEnabled } from "./hooks";

export function usePaymentInvoice(number: string, active: boolean) {
  const { companyId, user, permissions, hasPermission } = useAuth();
  const enabled = useAccountingQueryEnabled(active && Boolean(number.trim()) && hasPermission(PERMISSIONS.journalsCreate.name, PERMISSIONS.journalsCreate.resourceType));
  return useWorkspaceQuery({
    queryKey: ["accounting", "payment-invoice", companyId, user?.uid, permissions.map(permissionKey).sort(), number.trim()],
    queryFn: ({ signal }) => fetchPaymentInvoiceReference(number, signal),
    enabled,
    retry: false,
    staleTime: 0,
  });
}
