"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS, permissionKey } from "@/lib/auth/permissions";
import { fetchInvoiceById } from "@/lib/invoices/api/invoices-api";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

/** One invoice read when opened; independent of invoice journals and receipt data. */
export function useInvoiceLineItems(invoiceId: string) {
  const { isAuthenticated, companyId, user, email, roleId, permissions, permissionsLoading, hasPermission } = useAuth();
  const permission = PERMISSIONS.invoicesView;
  const canView = hasPermission(permission.name, permission.resourceType);
  return useWorkspaceQuery({
    queryKey: [...queryKeys.invoices.detail(invoiceId), "line-items", companyId, user?.uid || email || "", roleId, permissions.map(permissionKey).sort()],
    queryFn: ({ signal }) => fetchInvoiceById(invoiceId, signal),
    enabled: isAuthenticated && Boolean(companyId && invoiceId.trim()) && !permissionsLoading && canView,
    staleTime: 60_000,
  });
}
