"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import {
  createPredefinedRoute,
  deletePredefinedRoute,
  fetchAllPredefinedRoutes,
  updatePredefinedRoute,
} from "@/lib/predefined-routes/api/predefined-routes-api";
import type { PredefinedRouteFormValues } from "@/lib/predefined-routes/types";
import { PREDEFINED_ROUTE_FILTER_FIELD } from "@/lib/orders/predefined-route-filter";
import type { TableFilterFieldOption } from "@/lib/table/filter-types";

/** Predefined routes as `{ value: id, label: name }` options; only fetched while `enabled`. */
export function usePredefinedRouteFilterOptions(enabled: boolean) {
  const { companyId, hasPermission } = useAuth();
  const canView = hasPermission(PERMISSIONS.predefinedRoutesView.name, PERMISSIONS.predefinedRoutesView.resourceType);
  const query = useWorkspaceQuery({
    queryKey: [...queryKeys.predefinedRoutes.options(), companyId],
    queryFn: ({ signal }) => fetchAllPredefinedRoutes(signal),
    enabled: enabled && Boolean(companyId) && canView,
    staleTime: 5 * 60_000,
  });
  const options = useMemo<TableFilterFieldOption[]>(
    () => (query.data ?? []).map((route) => ({ value: String(route.id), label: route.name })),
    [query.data],
  );
  return { options, isLoading: query.isLoading, isError: query.isError, error: query.error, refetch: query.refetch, canView };
}

export function usePredefinedRouteMutations() {
  const { companyId } = useAuth();
  const client = useQueryClient();
  const invalidate = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.predefinedRoutes.all, predicate: (query) => query.queryKey.at(-1) === companyId }),
      // Appointment lists filtered by a predefined route depend on that route's cities / ZIP codes.
      client.invalidateQueries({
        predicate: (query) => query.queryKey.at(-1) === companyId && JSON.stringify(query.queryKey).includes(`"${PREDEFINED_ROUTE_FILTER_FIELD}"`),
      }),
    ]);
  return {
    create: useMutation({ mutationFn: createPredefinedRoute, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, values }: { id: number; values: PredefinedRouteFormValues }) =>
        updatePredefinedRoute(id, values),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deletePredefinedRoute, onSuccess: invalidate }),
  };
}
