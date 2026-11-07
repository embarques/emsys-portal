"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { fetchInvoicePoolSummary } from "@/lib/invoices/api/invoice-pool-api";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAppSelector } from "@/lib/store/hooks";

/**
 * Severe low-stock state for users who can generate offline invoice numbers:
 * the unassigned company pool is at or below the user's own warning threshold
 * (the same "this number or lower" rule the mobile app uses).
 */
export function useInvoicePoolLowStock() {
  const { companyId, user, email, hasPermission, loading, roleLoading } = useAuth();
  const transport = useAppSelector((state) => state.auth);
  const canView = hasPermission(PERMISSIONS.invoicePoolView.name, PERMISSIONS.invoicePoolView.resourceType);
  const canGenerate = hasPermission(PERMISSIONS.invoicePoolGenerate.name, PERMISSIONS.invoicePoolGenerate.resourceType);
  const ready = !loading && !roleLoading && !!companyId && !!transport.idToken && transport.companyId === companyId;
  const actor = user?.uid ?? email ?? "anonymous";

  const query = useWorkspaceQuery({
    // Shares the "invoice-pool" prefix so pool mutations and preference saves refresh it.
    queryKey: ["invoice-pool", companyId, actor, "low-stock"],
    enabled: ready && canView && canGenerate,
    queryFn: ({ signal }) => fetchInvoicePoolSummary(signal),
    staleTime: 60_000,
    retry: false,
  });

  const data = canView && canGenerate ? query.data : undefined;
  return {
    companyId,
    isLow: data ? data.remaining <= data.lowThreshold : false,
    remaining: data?.remaining ?? null,
    threshold: data?.lowThreshold ?? null,
    updatedAt: query.dataUpdatedAt,
  };
}
