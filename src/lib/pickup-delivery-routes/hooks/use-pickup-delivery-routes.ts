"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  fetchActiveRoute,
  fetchActiveRouteById,
  fetchActiveRoutes,
  deleteActiveRoute,
  deleteActiveRoutes,
  upsertActiveRoute,
} from "@/lib/pickup-delivery-routes/api/pickup-delivery-routes-api";
import {
  DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
  type ActiveRoute,
  type ActiveRouteFormValues,
  type ActiveRouteListParams,
  type ActiveRouteLookupParams,
  type RouteType,
} from "@/lib/pickup-delivery-routes/types";
import { hasListTextSearch } from "@/lib/api/search-query";
import { toRouteDateInput } from "@/lib/route-manager/types";
import { getScheduledRouteQueryKeys } from "@/lib/query/query-keys";

export function useActiveRoutePicker(
  routeType: RouteType,
  limit = 200,
  options: { enabled?: boolean } = {},
) {
  const listParams = {
    ...DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
    limit,
    routeType,
  };
  const keys = getScheduledRouteQueryKeys(routeType);

  return useWorkspaceQuery({
    queryKey: keys.list(listParams),
    queryFn: () => fetchActiveRoutes(listParams),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

/** Lookup scheduled pickup/delivery routes by vehicle-route record id. */
export function useActiveRouteLookup(
  routeType: RouteType,
  limit = 200,
  options: { enabled?: boolean } = {},
) {
  const query = useActiveRoutePicker(routeType, limit, options);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const byKey = useMemo(() => {
    const map = new Map<string, ActiveRoute>();
    for (const item of items) {
      if (item.id) {
        map.set(item.id, item);
      }
    }
    return map;
  }, [items]);

  return {
    items,
    getByKey: (key: string | undefined): ActiveRoute | undefined =>
      key ? byKey.get(key) : undefined,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useActiveRoutes(params: ActiveRouteListParams) {
  const routeType = params.routeType ?? "pickup";
  const isFiltered = hasListTextSearch(params.search);
  const keys = getScheduledRouteQueryKeys(routeType);

  return useWorkspaceQuery({
    queryKey: keys.list(params),
    queryFn: () => fetchActiveRoutes(params),
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useActiveRouteById(recordId: string | null, routeType: RouteType) {
  const keys = getScheduledRouteQueryKeys(routeType);

  return useWorkspaceQuery({
    queryKey: keys.byId(recordId ?? ""),
    queryFn: () => fetchActiveRouteById(recordId!, routeType),
    enabled: Boolean(recordId?.trim()),
  });
}

export function useActiveRoute(params: ActiveRouteLookupParams | null) {
  const routeType = params?.routeType ?? "pickup";
  const date = params?.date?.trim().slice(0, 10) ?? "";
  const containerId = params?.containerId ?? 0;
  const keys = getScheduledRouteQueryKeys(routeType);

  const enabled =
    Boolean(date) &&
    (routeType === "pickup" || (routeType === "delivery" && containerId > 0));

  return useWorkspaceQuery({
    queryKey:
      routeType === "delivery"
        ? keys.detail(date, containerId || undefined)
        : keys.detail(date),
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
      const keys = getScheduledRouteQueryKeys(record.routeType);

      return Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            record.routeType === "delivery"
              ? keys.detail(date, record.container?.id)
              : keys.detail(date),
        }),
        queryClient.invalidateQueries({
          queryKey: keys.byId(record.id),
        }),
        queryClient.invalidateQueries({ queryKey: keys.all }),
      ]);
    },
  });
}

function invalidateScheduledRoutes(
  queryClient: ReturnType<typeof useQueryClient>,
  routeType: RouteType,
) {
  return queryClient.invalidateQueries({
    queryKey: getScheduledRouteQueryKeys(routeType).all,
  });
}

export function useDeleteActiveRoute(routeType: RouteType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordId: string) => deleteActiveRoute(recordId, routeType),
    onSuccess: () => invalidateScheduledRoutes(queryClient, routeType),
  });
}

export function useDeleteActiveRoutes(routeType: RouteType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordIds: string[]) => deleteActiveRoutes(recordIds, routeType),
    onSuccess: () => invalidateScheduledRoutes(queryClient, routeType),
  });
}
