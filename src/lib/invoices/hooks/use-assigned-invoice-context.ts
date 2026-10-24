"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { fetchAssignedInvoiceContext } from "@/lib/invoices/api/assigned-invoice-context-api";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAppSelector } from "@/lib/store/hooks";

export function useAssignedInvoiceContext(date: string, enabled: boolean) {
  const { user, email, loading } = useAuth();
  const companyId = useAppSelector((state) => state.auth.companyId);
  const actorId = user?.uid || email || "";

  return useWorkspaceQuery({
    queryKey: queryKeys.invoices.assignedContext(companyId, actorId, date),
    queryFn: () => fetchAssignedInvoiceContext(date),
    enabled: enabled && !loading && Boolean(companyId && actorId && date),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
