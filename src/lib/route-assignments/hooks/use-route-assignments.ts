"use client";

import { useMemo } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRouteAssignment,
  deleteRouteAssignment,
  deleteRouteAssignments,
  fetchRouteAssignmentById,
  fetchRouteAssignments,
  fetchRouteAssignmentsByDate,
  updateRouteAssignment,
} from "@/lib/route-assignments/api/route-assignments-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import {
  DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS,
  todayDateInputValue,
  type RouteAssignment,
  type RouteAssignmentFormValues,
  type RouteAssignmentListParams,
  type RouteAssignmentSearchFilter,
} from "@/lib/route-assignments/types";
import { queryKeys } from "@/lib/query/query-keys";

export function useRouteAssignments(params: RouteAssignmentListParams) {
  const isFiltered = hasListTextSearch(params.search);

  return useQuery({
    queryKey: queryKeys.routeAssignments.list(params),
    queryFn: () => fetchRouteAssignments(params),
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useRouteAssignmentSearch(
  search: RouteAssignmentSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useQuery({
    queryKey: queryKeys.routeAssignments.search(search, limit),
    queryFn: () =>
      fetchRouteAssignments({
        ...DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
    placeholderData: keepPreviousData,
  });
}

export function useRouteAssignmentPicker(limit = 200, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.routeAssignments.list({ ...DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS, limit }),
    queryFn: () => fetchRouteAssignments({ ...DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS, limit }),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

/**
 * Picker data plus lookup maps indexed by both the human `routeAssignmentId`
 * code and the Mongo record `id`, so consumers can resolve either reference.
 */
export function useRouteAssignmentLookup(limit = 200, options: { enabled?: boolean } = {}) {
  const query = useRouteAssignmentPicker(limit, options);
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const byKey = useMemo(() => {
    const map = new Map<string, RouteAssignment>();
    for (const item of items) {
      if (item.routeAssignmentId) map.set(item.routeAssignmentId, item);
      if (item.id) map.set(item.id, item);
    }
    return map;
  }, [items]);

  return {
    items,
    getByKey: (key: string | undefined): RouteAssignment | undefined =>
      key ? byKey.get(key) : undefined,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/** KPIs are scoped to today's routes only — past/future routes are excluded. */
export function useRouteAssignmentKpis() {
  const today = todayDateInputValue();
  const query = useQuery({
    queryKey: queryKeys.routeAssignments.stats(`kpis:${today}`),
    queryFn: () => fetchRouteAssignmentsByDate(today),
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

export function useRouteAssignment(routeAssignmentId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.routeAssignments.detail(routeAssignmentId ?? ""),
    queryFn: () => fetchRouteAssignmentById(routeAssignmentId!),
    enabled: enabled && Boolean(routeAssignmentId?.trim()),
  });
}

function invalidateRouteAssignments(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.routeAssignments.all });
}

export function useCreateRouteAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: RouteAssignmentFormValues) => createRouteAssignment(values),
    onSuccess: () => invalidateRouteAssignments(queryClient),
  });
}

export function useUpdateRouteAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ recordId, values }: { recordId: string; values: RouteAssignmentFormValues }) =>
      updateRouteAssignment(recordId, values),
    onSuccess: (_data, variables) => {
      invalidateRouteAssignments(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.routeAssignments.detail(variables.recordId),
      });
    },
  });
}

export function useDeleteRouteAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordId: string) => deleteRouteAssignment(recordId),
    onSuccess: () => invalidateRouteAssignments(queryClient),
  });
}

export function useDeleteRouteAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (recordIds: string[]) => deleteRouteAssignments(recordIds),
    onSuccess: () => invalidateRouteAssignments(queryClient),
  });
}
