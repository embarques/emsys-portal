"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRoute,
  deleteRoute,
  deleteRoutes,
  fetchRouteById,
  fetchRoutes,
  updateRoute,
} from "@/lib/routes/api/routes-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import {
  DEFAULT_ROUTE_LIST_PARAMS,
  type RouteFormValues,
  type RouteListParams,
} from "@/lib/routes/types";
import { queryKeys } from "@/lib/query/query-keys";

function isRouteListFiltered(params: RouteListParams): boolean {
  return hasListTextSearch(params.search);
}

export function useRoutes(params: RouteListParams, options: { enabled?: boolean } = {}) {
  const isFiltered = isRouteListFiltered(params);

  return useQuery({
    queryKey: queryKeys.routes.list(params),
    queryFn: () => fetchRoutes(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useRouteStats() {
  const totalQuery = useQuery({
    queryKey: queryKeys.routes.stats("all"),
    queryFn: () => fetchRoutes({ ...DEFAULT_ROUTE_LIST_PARAMS, limit: 1 }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    isLoading: totalQuery.isLoading,
    isError: totalQuery.isError,
  };
}

export function useRouteKpis() {
  const query = useQuery({
    queryKey: queryKeys.routes.stats("kpis"),
    queryFn: () => fetchRoutes({ ...DEFAULT_ROUTE_LIST_PARAMS, limit: 200 }),
  });

  return {
    routes: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useRoute(routeId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.routes.detail(routeId ?? ""),
    queryFn: () => fetchRouteById(routeId!),
    enabled: enabled && Boolean(routeId),
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
    mutationFn: ({ routeId, values }: { routeId: string; values: RouteFormValues }) =>
      updateRoute(routeId, values),
    onSuccess: (_data, variables) => {
      invalidateRoutes(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.routes.detail(variables.routeId) });
    },
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (routeId: string) => deleteRoute(routeId),
    onSuccess: () => invalidateRoutes(queryClient),
  });
}

export function useDeleteRoutes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (routeIds: string[]) => deleteRoutes(routeIds),
    onSuccess: () => invalidateRoutes(queryClient),
  });
}
