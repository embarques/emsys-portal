"use client";

import { useMemo } from "react";
import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  assignPickupsToRoute,
  createRoute,
  deleteRoute,
  deleteRoutes,
  fetchRouteById,
  fetchRoutes,
  fetchRoutesByDate,
  updateRoute,
} from "@/lib/routes/api/routes-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import {
  DEFAULT_ROUTE_LIST_PARAMS,
  todayDateInputValue,
  type Route,
  type RouteFormValues,
  type RouteListParams,
  type RouteSearchFilter,
} from "@/lib/routes/types";
import { queryKeys } from "@/lib/query/query-keys";

export function useRoutes(params: RouteListParams) {
  const isFiltered = hasListTextSearch(params.search);

  return useWorkspaceQuery({
    queryKey: queryKeys.routes.list(params),
    queryFn: () => fetchRoutes(params),
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useRouteSearch(
  search: RouteSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useWorkspaceQuery({
    queryKey: queryKeys.routes.search(search, limit),
    queryFn: () =>
      fetchRoutes({
        ...DEFAULT_ROUTE_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
    placeholderData: keepPreviousData,
  });
}

export function useRoutePicker(limit = 200, options: { enabled?: boolean } = {}) {
  return useWorkspaceQuery({
    queryKey: queryKeys.routes.list({ ...DEFAULT_ROUTE_LIST_PARAMS, limit }),
    queryFn: () => fetchRoutes({ ...DEFAULT_ROUTE_LIST_PARAMS, limit }),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

/**
 * Picker data plus lookup maps indexed by both the human `routeId`
 * code and the Mongo record `id`, so consumers can resolve either reference.
 */
export function useRouteLookup(limit = 200, options: { enabled?: boolean } = {}) {
  const query = useRoutePicker(limit, options);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const byKey = useMemo(() => {
    const map = new Map<string, Route>();
    for (const item of items) {
      if (item.routeId) map.set(item.routeId, item);
      if (item.id) map.set(item.id, item);
    }
    return map;
  }, [items]);

  return {
    items,
    getByKey: (key: string | undefined): Route | undefined =>
      key ? byKey.get(key) : undefined,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/** KPIs are scoped to today's routes only — past/future routes are excluded. */
export function useRouteKpis() {
  const today = todayDateInputValue();
  const query = useWorkspaceQuery({
    queryKey: queryKeys.routes.stats("kpis", today),
    queryFn: () => fetchRoutesByDate(today),
    staleTime: 60_000,
  });

  const items = query.data?.items ?? [];

  return {
    total: query.data?.total ?? items.length,
    uniqueVehicles: new Set(items.map((item) => item.vehicle.id).filter(Boolean)).size,
    uniqueGroups: new Set(items.map((item) => item.employeeGroup.id).filter(Boolean)).size,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useRoute(routeId: string | null, enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.routes.detail(routeId ?? ""),
    queryFn: () => fetchRouteById(routeId!),
    enabled: enabled && Boolean(routeId?.trim()),
  });
}

function invalidateRoutes(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.routes.all });
}

export function useCreateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: RouteFormValues) => createRoute(values),
    onSuccess: () => invalidateRoutes(queryClient),
  });
}

export function useUpdateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recordId, values }: { recordId: string; values: RouteFormValues }) =>
      updateRoute(recordId, values),
    onSuccess: (_data, variables) => {
      invalidateRoutes(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.routes.detail(variables.recordId),
      });
    },
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordId: string) => deleteRoute(recordId),
    onSuccess: () => invalidateRoutes(queryClient),
  });
}

export function useDeleteRoutes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordIds: string[]) => deleteRoutes(recordIds),
    onSuccess: () => invalidateRoutes(queryClient),
  });
}

/** Assign pickups to a route; refreshes the orders list so route refs appear. */
export function useAssignPickupsToRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ routeId, pickupIds }: { routeId: string; pickupIds: number[] }) =>
      assignPickupsToRoute(routeId, pickupIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
  });
}
