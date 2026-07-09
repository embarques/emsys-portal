"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  createBarcodeRecord,
  deleteBarcode,
  deleteBarcodes,
  fetchBarcodeRecord,
  fetchBarcodes,
  updateBarcodeRecord,
} from "@/lib/barcodes/api/barcodes-catalog-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import { BARCODE_TABLE_FILTER_FIELDS } from "@/lib/barcodes/filter-fields";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import {
  DEFAULT_BARCODE_LIST_PARAMS,
  type BarcodeFormValues,
  type BarcodeListParams,
  type BarcodeSearchFilter,
} from "@/lib/barcodes/types";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { queryKeys } from "@/lib/query/query-keys";

function isBarcodeListFiltered(params: BarcodeListParams): boolean {
  const hasRowFilters = (params.filterRows ?? []).some((row) =>
    isCompleteFilterRow(row, BARCODE_TABLE_FILTER_FIELDS),
  );

  return hasListTextSearch(params.search) || hasRowFilters;
}

export function useBarcodeSearch(
  search: BarcodeSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useWorkspaceQuery({
    queryKey: queryKeys.barcodes.search(search, limit),
    queryFn: () =>
      fetchBarcodes({
        ...DEFAULT_BARCODE_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useBarcodes(params: BarcodeListParams, options: { enabled?: boolean } = {}) {
  const isFiltered = isBarcodeListFiltered(params);

  return useWorkspaceQuery({
    queryKey: queryKeys.barcodes.list(params),
    queryFn: () => fetchBarcodes(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useBarcodeStats() {
  const totalQuery = useWorkspaceQuery({
    queryKey: queryKeys.barcodes.stats("all"),
    queryFn: () => fetchBarcodes({ ...DEFAULT_BARCODE_LIST_PARAMS, limit: 1 }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    isLoading: totalQuery.isLoading,
    isError: totalQuery.isError,
  };
}

export function useBarcodeKpis() {
  const query = useWorkspaceQuery({
    queryKey: queryKeys.barcodes.stats("kpis"),
    queryFn: () => fetchBarcodes({ ...DEFAULT_BARCODE_LIST_PARAMS, limit: 200 }),
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useBarcode(barcodeId: number | null, enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.barcodes.detail(barcodeId ?? 0),
    queryFn: () => fetchBarcodeRecord(barcodeId!),
    enabled: enabled && barcodeId != null && barcodeId > 0,
  });
}

function invalidateBarcodes(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.barcodes.all });
}

export function useCreateBarcode() {
  const queryClient = useQueryClient();
  const containersQuery = useContainerPicker(200);

  return useMutation({
    mutationFn: (values: BarcodeFormValues) =>
      createBarcodeRecord(values, containersQuery.data?.items ?? []),
    onSuccess: () => invalidateBarcodes(queryClient),
  });
}

export function useUpdateBarcode() {
  const queryClient = useQueryClient();
  const containersQuery = useContainerPicker(200);

  return useMutation({
    mutationFn: ({ barcodeId, values }: { barcodeId: number; values: BarcodeFormValues }) =>
      updateBarcodeRecord(barcodeId, values, containersQuery.data?.items ?? []),
    onSuccess: (_data, variables) => {
      invalidateBarcodes(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.barcodes.detail(variables.barcodeId),
      });
    },
  });
}

export function useDeleteBarcode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (barcodeId: number) => deleteBarcode(barcodeId),
    onSuccess: () => invalidateBarcodes(queryClient),
  });
}

export function useDeleteBarcodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (barcodeIds: number[]) => deleteBarcodes(barcodeIds),
    onSuccess: () => invalidateBarcodes(queryClient),
  });
}
