"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  fetchActiveRoute,
  fetchActiveRoutes,
  deleteActiveRoute,
  deleteActiveRoutes,
  upsertActiveRoute,
} from "@/lib/active-routes/api/active-routes-api";
import type {
  ActiveRouteFormValues,
  ActiveRouteListParams,
  ActiveRouteLookupParams,
} from "@/lib/active-routes/types";
import { hasListTextSearch } from "@/lib/api/search-query";
import { toRouteDateInput } from "@/lib/routes/types";
import { queryKeys } from "@/lib/query/query-keys";

export function useActiveRoutes(params: ActiveRouteListParams) {
  const isFiltered = hasListTextSearch(params.search);

  return useWorkspaceQuery({
    queryKey: queryKeys.activeRoutes.list(params),
    queryFn: () => fetchActiveRoutes(params),
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useActiveRoute(params: ActiveRouteLookupParams | null) {
  const routeType = params?.routeType ?? "pickup";
  const date = params?.date?.trim().slice(0, 10) ?? "";
  const containerId = params?.containerId ?? 0;

  const enabled =
    Boolean(date) &&
    (routeType === "pickup" || (routeType === "delivery" && containerId > 0));

  return useWorkspaceQuery({
    queryKey: queryKeys.activeRoutes.detail(routeType, date, containerId || undefined),
    queryFn: () =>
      fetchActiveRoute({
        routeType,
        date,
        ...(routeType === "delivery" && containerId > 0 ? { containerId } : {}),
      }),
    enabled,
    staleTime: 0,
  });
}

export function useUpsertActiveRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      values: ActiveRouteFormValues;
      existingId?: string | null;
    }) => upsertActiveRoute(input.values, input.existingId),
    onSuccess: (record) => {
      const date = toRouteDateInput(record.date) || record.date;
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.activeRoutes.detail(
            record.routeType,
            date,
            record.container?.id,
          ),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activeRoutes.all }),
      ]);
    },
  });
}

function invalidateActiveRoutes(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.activeRoutes.all });
}

export function useDeleteActiveRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordId: string) => deleteActiveRoute(recordId),
    onSuccess: () => invalidateActiveRoutes(queryClient),
  });
}

export function useDeleteActiveRoutes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordIds: string[]) => deleteActiveRoutes(recordIds),
    onSuccess: () => invalidateActiveRoutes(queryClient),
  });
}
