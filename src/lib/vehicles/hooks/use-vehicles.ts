"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  createVehicle,
  deleteVehicle,
  deleteVehicles,
  fetchVehicleById,
  fetchVehicles,
  updateVehicle,
} from "@/lib/vehicles/api/vehicles-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import { VEHICLE_TABLE_FILTER_FIELDS } from "@/lib/vehicles/filter-fields";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import {
  DEFAULT_VEHICLE_LIST_PARAMS,
  type VehicleFormValues,
  type VehicleListParams,
  type VehiclePortalBranch,
  type VehicleSearchFilter,
} from "@/lib/vehicles/types";
import { queryKeys } from "@/lib/query/query-keys";

function isVehicleListFiltered(params: VehicleListParams): boolean {
  const hasRowFilters = (params.filterRows ?? []).some((row) =>
    isCompleteFilterRow(row, VEHICLE_TABLE_FILTER_FIELDS),
  );

  return hasListTextSearch(params.search) || hasRowFilters;
}

export function useVehicleSearch(
  search: VehicleSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useWorkspaceQuery({
    queryKey: queryKeys.vehicles.search(search, limit),
    queryFn: () =>
      fetchVehicles({
        ...DEFAULT_VEHICLE_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useVehicles(params: VehicleListParams, options: { enabled?: boolean } = {}) {
  const isFiltered = isVehicleListFiltered(params);

  return useWorkspaceQuery({
    queryKey: queryKeys.vehicles.list(params),
    queryFn: () => fetchVehicles(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useVehicleStats() {
  const totalQuery = useWorkspaceQuery({
    queryKey: queryKeys.vehicles.stats("all"),
    queryFn: () => fetchVehicles({ ...DEFAULT_VEHICLE_LIST_PARAMS, limit: 1 }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    isLoading: totalQuery.isLoading,
    isError: totalQuery.isError,
  };
}

export function useVehicleBranchCount(branch: VehiclePortalBranch) {
  const query = useWorkspaceQuery({
    queryKey: queryKeys.vehicles.stats(`branch:${branch}`),
    queryFn: () =>
      fetchVehicles({
        ...DEFAULT_VEHICLE_LIST_PARAMS,
        limit: 1,
        search: { field: "branch.code", operator: "eq", value: branch },
      }),
  });

  return {
    count: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useVehicleKpis() {
  const query = useWorkspaceQuery({
    queryKey: queryKeys.vehicles.stats("kpis"),
    queryFn: () => fetchVehicles({ ...DEFAULT_VEHICLE_LIST_PARAMS, limit: 200 }),
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useVehicle(vehicleId: string | null, enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.vehicles.detail(vehicleId ?? ""),
    queryFn: () => fetchVehicleById(vehicleId!),
    enabled: enabled && Boolean(vehicleId?.trim()),
  });
}

export function useVehiclePicker(limit = 200, options: { enabled?: boolean } = {}) {
  return useVehicles(
    {
      ...DEFAULT_VEHICLE_LIST_PARAMS,
      limit,
    },
    options,
  );
}

function invalidateVehicles(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.vehicles.all });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: VehicleFormValues) => createVehicle(values),
    onSuccess: () => invalidateVehicles(queryClient),
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ vehicleId, values }: { vehicleId: string; values: VehicleFormValues }) =>
      updateVehicle(vehicleId, values),
    onSuccess: (_data, variables) => {
      invalidateVehicles(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.vehicles.detail(variables.vehicleId),
      });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vehicleId: string) => deleteVehicle(vehicleId),
    onSuccess: () => invalidateVehicles(queryClient),
  });
}

export function useDeleteVehicles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vehicleIds: string[]) => deleteVehicles(vehicleIds),
    onSuccess: () => invalidateVehicles(queryClient),
  });
}
