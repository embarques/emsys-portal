"use client";

import { useMemo } from "react";
import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/query/query-keys";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAppSelector } from "@/lib/store/hooks";

const branchPageSchema = z.object({
  success: z.literal(true),
  data: z.array(z.object({ id: z.number().int().positive(), code: z.string().optional(), name: z.string().optional() })),
  total: z.number().int().nonnegative(),
});

export function useInvoicePaymentLocations(enabled = true) {
  const { companyId, user, email, loading, roleLoading, hasPermission } = useAuth();
  const transport = useAppSelector((state) => state.auth);
  const allowed = [PERMISSIONS.invoicesCreate, PERMISSIONS.invoicesCreateAssigned, PERMISSIONS.invoicesUpdate]
    .some(({ name, resourceType }) => hasPermission(name, resourceType));
  const query = useWorkspaceQuery({
    queryKey: [...queryKeys.branches.all, "invoice-payment-locations", companyId, user?.uid ?? email],
    enabled: enabled && allowed && !loading && !roleLoading && !!transport.idToken && !!companyId && transport.companyId === companyId,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const branches: z.infer<typeof branchPageSchema>["data"] = [];
      for (let page = 1; ; page++) {
        const result = branchPageSchema.parse(await apiClient.get(API_ENDPOINTS.INVOICE_PAYMENT_LOCATIONS, {
          params: { page, limit: 200 }, signal,
        }));
        branches.push(...result.data);
        if (!result.data.length || branches.length >= result.total) return branches;
      }
    },
  });
  const options = useMemo(() => (query.data ?? []).map(({ id, code, name }) => {
    const branchCode = code?.trim().toUpperCase();
    const value = `BRANCH:${id}`;
    return { value, code: branchCode, label: [name?.trim(), branchCode].filter(Boolean).join(" · ") || value };
  }), [query.data]);
  return { branches: query.data, options, isLoading: query.isLoading, isError: query.isError };
}
