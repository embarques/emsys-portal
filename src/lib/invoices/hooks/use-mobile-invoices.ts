"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useWorkspaceTabQueriesEnabled } from "@/lib/layout/workspace-tab-scope";
import { useAppSelector } from "@/lib/store/hooks";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { fetchInvoices } from "@/lib/invoices/api/invoices-api";
import { nextMobileInvoicePage } from "@/lib/invoices/mobile-list";
import type { InvoiceListParams } from "@/lib/invoices/types";

export function useMobileInvoices(params: InvoiceListParams, enabled: boolean) {
  const active = useWorkspaceTabQueriesEnabled();
  const { companyId, user, loading, roleLoading, hasPermission } = useAuth();
  const transport = useAppSelector(state => state.auth);
  return useInfiniteQuery({
    queryKey: ["invoices", "mobile", companyId, user?.uid, params],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchInvoices({ ...params, page: pageParam }, signal),
    getNextPageParam: (last, _pages, lastPageParam) => nextMobileInvoicePage(last, lastPageParam),
    enabled: enabled && active && !!companyId && !!transport.idToken && transport.companyId === companyId && !loading && !roleLoading && hasPermission("canViewInvoice", "invoice"),
    retry: false,
  });
}
