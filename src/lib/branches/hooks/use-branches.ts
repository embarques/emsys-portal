"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createBranch,
  deleteBranch,
  deleteBranches,
  fetchBranchById,
  fetchBranches,
  updateBranch,
} from "@/lib/branches/api/branches-api";
import {
  DEFAULT_BRANCH_LIST_PARAMS,
  type BranchFormValues,
  type BranchListParams,
  type BranchSearchFilter,
} from "@/lib/branches/types";
import { queryKeys } from "@/lib/query/query-keys";

export function useBranchSearch(
  search: BranchSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useQuery({
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

export function useBranches(params: BranchListParams) {
  return useQuery({
    queryKey: queryKeys.branches.list(params),
    queryFn: () => fetchBranches(params),
  });
}

export function useBranchStats() {
  const totalQuery = useQuery({
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
  return useQuery({
    queryKey: queryKeys.branches.detail(branchId ?? 0),
    queryFn: () => fetchBranchById(branchId!),
    enabled: enabled && branchId != null && branchId > 0,
  });
}

export function useBranchPicker(limit = 200) {
  return useBranches({
    ...DEFAULT_BRANCH_LIST_PARAMS,
    limit,
  });
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
