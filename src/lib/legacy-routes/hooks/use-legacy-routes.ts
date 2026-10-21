"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import {
  createLegacyRoute,
  deleteLegacyRoute,
  fetchAllLegacyRoutes,
  updateLegacyRoute,
} from "@/lib/legacy-routes/api/legacy-routes-api";
import type { LegacyRouteFormValues } from "@/lib/legacy-routes/types";
import { LEGACY_ROUTE_FILTER_FIELD } from "@/lib/orders/legacy-route-filter";
import type { TableFilterFieldOption } from "@/lib/table/filter-types";

/** Legacy routes as `{ value: id, label: name }` options; only fetched while `enabled`. */
export function useLegacyRouteFilterOptions(enabled: boolean) {
  const query = useWorkspaceQuery({
    queryKey: queryKeys.legacyRoutes.options(),
    queryFn: fetchAllLegacyRoutes,
    enabled,
    staleTime: 5 * 60_000,
  });
  const options = useMemo<TableFilterFieldOption[]>(
    () => (query.data ?? []).map((route) => ({ value: String(route.id), label: route.name })),
    [query.data],
  );
  return { options, isLoading: query.isLoading };
}

export function useLegacyRouteMutations() {
  const client = useQueryClient();
  const invalidate = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.legacyRoutes.all }),
      // Appointment lists filtered by a legacy route depend on that route's cities / ZIP codes.
      client.invalidateQueries({
        predicate: (query) => JSON.stringify(query.queryKey).includes(`"${LEGACY_ROUTE_FILTER_FIELD}"`),
      }),
    ]);
  return {
    create: useMutation({ mutationFn: createLegacyRoute, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, values }: { id: number; values: LegacyRouteFormValues }) =>
        updateLegacyRoute(id, values),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteLegacyRoute, onSuccess: invalidate }),
  };
}
