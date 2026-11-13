"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { permissionKey } from "@/lib/auth/permissions";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import { fetchRouteBusinessDate, routeBusinessDateLifetime } from "@/lib/pickup-delivery-routes/api/route-business-date-api";

/** Shared across open pickers; no polling while disabled or in a hidden workspace. */
export function useAssignmentBusinessDate(enabled = true, branchId?: number) {
  const { companyId, user, email, roleId, permissions, isAuthenticated, permissionsLoading } = useAuth();
  const ready = enabled && isAuthenticated && Boolean(companyId) && !permissionsLoading;
  const query = useWorkspaceQuery({
    queryKey: queryKeys.routeBusinessDate.detail({
      companyId, actorId: user?.uid || email || "", roleId,
      permissions: permissions.map(permissionKey).sort(), authenticated: isAuthenticated, branchId: branchId ?? null,
    }),
    queryFn: ({ signal }) => fetchRouteBusinessDate(branchId, signal),
    enabled: ready,
    staleTime: 60_000,
    refetchOnWindowFocus: "always",
    refetchInterval: query => query.state.data
      ? Math.max(1_000, routeBusinessDateLifetime(query.state.data) - (Date.now() - query.state.dataUpdatedAt))
      : false,
    retry: false,
  });
  // Hide the previous day during a midnight/focus refresh rather than guess its validity.
  return { ...query, today: ready && !query.isError && !query.isFetching
    ? query.data?.businessDate ?? "" : "" };
}

/** Empty until the API supplies the company's business day; never guesses from the browser. */
export function useAssignmentToday(enabled = true, branchId?: number): string {
  const clock = useAssignmentBusinessDate(enabled, branchId);
  return clock.today;
}
