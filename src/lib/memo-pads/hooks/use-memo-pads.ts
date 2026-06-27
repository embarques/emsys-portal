"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createMemoPad,
  deleteMemoPad,
  deleteMemoPads,
  fetchMemoPadById,
  fetchMemoPads,
  updateMemoPad,
} from "@/lib/memo-pads/api/memo-pads-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import {
  DEFAULT_MEMO_PAD_LIST_PARAMS,
  type MemoPadFormValues,
  type MemoPadListParams,
  type MemoPadSearchFilter,
} from "@/lib/memo-pads/types";
import { queryKeys } from "@/lib/query/query-keys";

function isMemoPadListFiltered(params: MemoPadListParams): boolean {
  const hasRowFilters = (params.filterRows ?? []).some((row) => isCompleteFilterRow(row));
  return hasListTextSearch(params.search) || hasRowFilters;
}

export function useMemoPads(params: MemoPadListParams) {
  const isFiltered = isMemoPadListFiltered(params);

  return useQuery({
    queryKey: queryKeys.memoPads.list(params),
    queryFn: () => fetchMemoPads(params),
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useMemoPadSearch(
  search: MemoPadSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useQuery({
    queryKey: queryKeys.memoPads.search(search, limit),
    queryFn: () => fetchMemoPads({ ...DEFAULT_MEMO_PAD_LIST_PARAMS, limit, search }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useMemoPad(memoPadId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.memoPads.detail(memoPadId ?? ""),
    queryFn: () => fetchMemoPadById(memoPadId!),
    enabled: enabled && Boolean(memoPadId),
  });
}

function invalidateMemoPads(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.memoPads.all });
}

export function useCreateMemoPad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: MemoPadFormValues) => createMemoPad(values),
    onSuccess: () => invalidateMemoPads(queryClient),
  });
}

export function useUpdateMemoPad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memoPadId, values }: { memoPadId: string; values: MemoPadFormValues }) =>
      updateMemoPad(memoPadId, values),
    onSuccess: (_data, variables) => {
      invalidateMemoPads(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.memoPads.detail(variables.memoPadId),
      });
    },
  });
}

export function useDeleteMemoPad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memoPadId: string) => deleteMemoPad(memoPadId),
    onSuccess: () => invalidateMemoPads(queryClient),
  });
}

export function useDeleteMemoPads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memoPadIds: string[]) => deleteMemoPads(memoPadIds),
    onSuccess: () => invalidateMemoPads(queryClient),
  });
}
