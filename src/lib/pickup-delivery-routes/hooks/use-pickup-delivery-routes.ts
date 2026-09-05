"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  fetchActiveRoute,
  fetchActiveRouteById,
  fetchActiveRoutes,
  fetchVehicleRouteByCrewAndDate,
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
import { hasResourceListFilters } from "@/lib/api/search-query";
import { getScheduledRouteQueryKeys, queryKeys } from "@/lib/query/query-keys";
import { getActiveRouteTableFilterFields } from "@/lib/pickup-delivery-routes/filter-fields";

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

export function useDailyRoutePicker(limit = 200, options: { enabled?: boolean } = {}) {
  const listParams = {
    ...DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
    limit,
  };

  return useWorkspaceQuery({
    queryKey: queryKeys.dailyRouteSchedules.list(listParams),
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

export function useActiveRoutes(
  params: ActiveRouteListParams,
  options: { enabled?: boolean } = {},
) {
  const isFiltered = hasResourceListFilters({
    search: params.search,
    filterRows: params.filterRows,
    tableFilterFields: getActiveRouteTableFilterFields(params.routeType),
    hasChipFilters: Boolean(params.branchCode?.trim()),
  });
  const keys = getScheduledRouteQueryKeys(params.routeType);

  return useWorkspaceQuery({
    queryKey: keys.list(params),
    queryFn: () => fetchActiveRoutes(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useActiveRouteById(recordId: string | null, routeType?: RouteType) {
  const id = recordId ?? "";
  const queryKey =
    routeType === "delivery"
      ? queryKeys.deliveryRouteSchedules.byId(id)
      : routeType === "pickup"
        ? queryKeys.pickupRouteSchedules.byId(id)
        : queryKeys.dailyRouteSchedules.byId(id);

  return useWorkspaceQuery({
    queryKey,
    queryFn: () => fetchActiveRouteById(recordId!, routeType),
    enabled: Boolean(recordId?.trim()),
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
    queryKey:
      routeType === "delivery"
        ? queryKeys.deliveryRouteSchedules.detail(date, containerId || undefined)
        : queryKeys.pickupRouteSchedules.detail(date),
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

export function useScheduledRouteByCrewAndDate(input: {
  routeRecordId: string | null;
  date: string;
  routeType: RouteType;
  containerId?: number;
  vehicleId?: string;
  enabled?: boolean;
}) {
  const id = input.routeRecordId?.trim() ?? "";
  const isoDate = input.date.trim().slice(0, 10);
  const containerId = input.containerId ?? 0;
  const vehicleId = input.vehicleId?.trim() ?? "";
  const enabled =
    (input.enabled ?? true) &&
    Boolean(id && isoDate) &&
    (input.routeType === "pickup" || containerId > 0);

  return useWorkspaceQuery({
    queryKey:
      input.routeType === "delivery"
        ? queryKeys.deliveryRouteSchedules.byCrewAndDate(id, isoDate, containerId)
        : queryKeys.pickupRouteSchedules.byCrewAndDate(id, isoDate, vehicleId),
    queryFn: () =>
      fetchVehicleRouteByCrewAndDate({
        routeRecordId: id,
        date: isoDate,
        routeType: input.routeType,
        ...(input.routeType === "delivery" ? { containerId } : { vehicleId }),
      }),
    enabled,
    staleTime: 0,
  });
}

export function usePickupRouteByGroupAndDate(routeRecordId: string | null, date: string) {
  return useScheduledRouteByCrewAndDate({
    routeRecordId,
    date,
    routeType: "pickup",
  });
}

export function useUpsertActiveRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      values: ActiveRouteFormValues;
      existingId?: string | null;
    }) => upsertActiveRoute(input.values, input.existingId),
    onSuccess: () => invalidateScheduledRoutes(queryClient),
  });
}

function invalidateScheduledRoutes(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.pickupRouteSchedules.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.deliveryRouteSchedules.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.dailyRouteSchedules.all }),
  ]);
}

export function useDeleteActiveRoute(_routeType?: RouteType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordId: string) => deleteActiveRoute(recordId),
    onSuccess: () => invalidateScheduledRoutes(queryClient),
  });
}

export function useDeleteActiveRoutes(_routeType?: RouteType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordIds: string[]) => deleteActiveRoutes(recordIds),
    onSuccess: () => invalidateScheduledRoutes(queryClient),
  });
}
