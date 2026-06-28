"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  createContainer,
  deleteContainer,
  deleteContainers,
  fetchContainerById,
  fetchContainers,
  updateContainer,
} from "@/lib/containers/api/containers-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import { CONTAINER_TABLE_FILTER_FIELDS } from "@/lib/containers/filter-fields";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import {
  DEFAULT_CONTAINER_LIST_PARAMS,
  type ContainerFormValues,
  type ContainerListParams,
  type ContainerSearchFilter,
} from "@/lib/containers/types";
import { queryKeys } from "@/lib/query/query-keys";

function isContainerListFiltered(params: ContainerListParams): boolean {
  const hasRowFilters = (params.filterRows ?? []).some((row) =>
    isCompleteFilterRow(row, CONTAINER_TABLE_FILTER_FIELDS),
  );

  return hasListTextSearch(params.search) || hasRowFilters;
}

export function useContainerSearch(
  search: ContainerSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useWorkspaceQuery({
    queryKey: queryKeys.containers.search(search, limit),
    queryFn: () =>
      fetchContainers({
        ...DEFAULT_CONTAINER_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useContainers(params: ContainerListParams, options: { enabled?: boolean } = {}) {
  const isFiltered = isContainerListFiltered(params);

  return useWorkspaceQuery({
    queryKey: queryKeys.containers.list(params),
    queryFn: () => fetchContainers(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useContainerStats() {
  const totalQuery = useWorkspaceQuery({
    queryKey: queryKeys.containers.stats("all"),
    queryFn: () => fetchContainers({ ...DEFAULT_CONTAINER_LIST_PARAMS, limit: 1 }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    isLoading: totalQuery.isLoading,
    isError: totalQuery.isError,
  };
}

export function useContainerKpis() {
  const query = useWorkspaceQuery({
    queryKey: queryKeys.containers.stats("kpis"),
    queryFn: () => fetchContainers({ ...DEFAULT_CONTAINER_LIST_PARAMS, limit: 200 }),
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useContainer(containerId: number | null, enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.containers.detail(containerId ?? 0),
    queryFn: () => fetchContainerById(containerId!),
    enabled: enabled && containerId != null && containerId > 0,
  });
}

export function useContainerPicker(limit = 200, options: { enabled?: boolean } = {}) {
  return useContainers(
    {
      ...DEFAULT_CONTAINER_LIST_PARAMS,
      limit,
    },
    options,
  );
}

function invalidateContainers(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.containers.all });
}

export function useCreateContainer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ContainerFormValues) => createContainer(values),
    onSuccess: () => invalidateContainers(queryClient),
  });
}

export function useUpdateContainer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ containerId, values }: { containerId: number; values: ContainerFormValues }) =>
      updateContainer(containerId, values),
    onSuccess: (_data, variables) => {
      invalidateContainers(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.containers.detail(variables.containerId),
      });
    },
  });
}

export function useDeleteContainer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (containerId: number) => deleteContainer(containerId),
    onSuccess: () => invalidateContainers(queryClient),
  });
}

export function useDeleteContainers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (containerIds: number[]) => deleteContainers(containerIds),
    onSuccess: () => invalidateContainers(queryClient),
  });
}
