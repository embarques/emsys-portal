"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  createBranch,
  deleteBranch,
  deleteBranches,
  fetchBranchById,
  fetchBranches,
  updateBranch,
} from "@/lib/branches/api/branches-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import { BRANCH_TABLE_FILTER_FIELDS } from "@/lib/branches/filter-fields";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import {
  DEFAULT_BRANCH_LIST_PARAMS,
  type BranchFormValues,
  type BranchListParams,
  type BranchSearchFilter,
} from "@/lib/branches/types";
import { queryKeys } from "@/lib/query/query-keys";

function isBranchListFiltered(params: BranchListParams): boolean {
  const hasRowFilters = (params.filterRows ?? []).some((row) =>
    isCompleteFilterRow(row, BRANCH_TABLE_FILTER_FIELDS),
  );
  const hasChipFilters = Boolean(params.type && params.type !== "all");

  return hasListTextSearch(params.search) || hasRowFilters || hasChipFilters;
}

export function useBranchSearch(
  search: BranchSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useWorkspaceQuery({
    queryKey: queryKeys.branches.search(search, limit),
    queryFn: () =>
      fetchBranches({
        ...DEFAULT_BRANCH_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useBranches(params: BranchListParams, options: { enabled?: boolean } = {}) {
  const isFiltered = isBranchListFiltered(params);

  return useWorkspaceQuery({
    queryKey: queryKeys.branches.list(params),
    queryFn: () => fetchBranches(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useBranchStats() {
  const totalQuery = useWorkspaceQuery({
    queryKey: queryKeys.branches.stats("all"),
    queryFn: () => fetchBranches({ ...DEFAULT_BRANCH_LIST_PARAMS, limit: 1 }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    isLoading: totalQuery.isLoading,
    isError: totalQuery.isError,
  };
}

export function useBranch(branchId: number | null, enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.branches.detail(branchId ?? 0),
    queryFn: () => fetchBranchById(branchId!),
    enabled: enabled && branchId != null && branchId > 0,
  });
}

export function useBranchPicker(limit = 200, options: { enabled?: boolean } = {}) {
  return useBranches(
    {
      ...DEFAULT_BRANCH_LIST_PARAMS,
      limit,
    },
    options,
  );
}

function invalidateBranches(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.branches.all });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: BranchFormValues) => createBranch(values),
    onSuccess: () => invalidateBranches(queryClient),
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ branchId, values }: { branchId: number; values: BranchFormValues }) =>
      updateBranch(branchId, values),
    onSuccess: (_data, variables) => {
      invalidateBranches(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.branches.detail(variables.branchId),
      });
    },
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (branchId: number) => deleteBranch(branchId),
    onSuccess: () => invalidateBranches(queryClient),
  });
}

export function useDeleteBranches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (branchIds: number[]) => deleteBranches(branchIds),
    onSuccess: () => invalidateBranches(queryClient),
  });
}
