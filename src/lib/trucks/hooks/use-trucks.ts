"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createTruck,
  deleteTruck,
  deleteTrucks,
  fetchTruckById,
  fetchTrucks,
  updateTruck,
} from "@/lib/trucks/api/trucks-api";
import {
  DEFAULT_TRUCK_LIST_PARAMS,
  type TruckFormValues,
  type TruckListParams,
  type TruckSearchFilter,
} from "@/lib/trucks/types";
import { queryKeys } from "@/lib/query/query-keys";

export function useTruckSearch(
  search: TruckSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useQuery({
    queryKey: queryKeys.trucks.search(search, limit),
    queryFn: () =>
      fetchTrucks({
        ...DEFAULT_TRUCK_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useTrucks(params: TruckListParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.trucks.list(params),
    queryFn: () => fetchTrucks(params),
    enabled: options.enabled ?? true,
  });
}

export function useTruckStats() {
  const totalQuery = useQuery({
    queryKey: queryKeys.trucks.stats("all"),
    queryFn: () => fetchTrucks({ ...DEFAULT_TRUCK_LIST_PARAMS, limit: 1 }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    isLoading: totalQuery.isLoading,
    isError: totalQuery.isError,
  };
}

export function useTruckKpis() {
  const query = useQuery({
    queryKey: queryKeys.trucks.stats("kpis"),
    queryFn: () => fetchTrucks({ ...DEFAULT_TRUCK_LIST_PARAMS, limit: 200 }),
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useTruck(truckId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.trucks.detail(truckId ?? ""),
    queryFn: () => fetchTruckById(truckId!),
    enabled: enabled && Boolean(truckId?.trim()),
  });
}

export function useTruckPicker(limit = 200, options: { enabled?: boolean } = {}) {
  return useTrucks(
    {
      ...DEFAULT_TRUCK_LIST_PARAMS,
      limit,
    },
    options,
  );
}

function invalidateTrucks(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.trucks.all });
}

export function useCreateTruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: TruckFormValues) => createTruck(values),
    onSuccess: () => invalidateTrucks(queryClient),
  });
}

export function useUpdateTruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ truckId, values }: { truckId: string; values: TruckFormValues }) =>
      updateTruck(truckId, values),
    onSuccess: (_data, variables) => {
      invalidateTrucks(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.trucks.detail(variables.truckId),
      });
    },
  });
}

export function useDeleteTruck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (truckId: string) => deleteTruck(truckId),
    onSuccess: () => invalidateTrucks(queryClient),
  });
}

export function useDeleteTrucks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (truckIds: string[]) => deleteTrucks(truckIds),
    onSuccess: () => invalidateTrucks(queryClient),
  });
}
