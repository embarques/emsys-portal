"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addInvoicesToDelivery,
  createDelivery,
  deleteDeliveries,
  fetchDeliveries,
  fetchDeliveryBarcodes,
  fetchDeliveryById,
  updateDelivery,
} from "@/lib/deliveries/api/deliveries-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import { DELIVERY_TABLE_FILTER_FIELDS } from "@/lib/deliveries/filter-fields";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import {
  DEFAULT_DELIVERY_LIST_PARAMS,
  type Delivery,
  type DeliveryContainerRef,
  type DeliveryEmployeeRef,
  type DeliveryFormValues,
  type DeliveryListParams,
  type DeliverySearchFilter,
} from "@/lib/deliveries/types";
import type { Invoice } from "@/lib/invoices/types";
import { queryKeys } from "@/lib/query/query-keys";

function isDeliveryListFiltered(params: DeliveryListParams): boolean {
  const hasRowFilters = (params.filterRows ?? []).some((row) =>
    isCompleteFilterRow(row, DELIVERY_TABLE_FILTER_FIELDS),
  );

  return hasListTextSearch(params.search) || hasRowFilters;
}

export function useDeliverySearch(
  search: DeliverySearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useQuery({
    queryKey: queryKeys.deliveries.search(search, limit),
    queryFn: () =>
      fetchDeliveries({
        ...DEFAULT_DELIVERY_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useDeliveries(params: DeliveryListParams, options: { enabled?: boolean } = {}) {
  const isFiltered = isDeliveryListFiltered(params);

  return useQuery({
    queryKey: queryKeys.deliveries.list(params),
    queryFn: () => fetchDeliveries(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useDeliveryStats() {
  const query = useQuery({
    queryKey: queryKeys.deliveries.stats("all"),
    queryFn: () => fetchDeliveries({ ...DEFAULT_DELIVERY_LIST_PARAMS, limit: 1 }),
  });

  return {
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useDeliveryKpis() {
  const query = useQuery({
    queryKey: queryKeys.deliveries.stats("kpis"),
    queryFn: () => fetchDeliveries({ ...DEFAULT_DELIVERY_LIST_PARAMS, limit: 200 }),
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useDelivery(deliveryId: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.deliveries.detail(deliveryId ?? 0),
    queryFn: () => fetchDeliveryById(deliveryId!),
    enabled: enabled && deliveryId != null && deliveryId > 0,
  });
}

export function useDeliveryBarcodes(deliveryId: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.deliveries.barcodes(deliveryId ?? 0),
    queryFn: () => fetchDeliveryBarcodes(deliveryId!),
    enabled: enabled && deliveryId != null && deliveryId > 0,
  });
}

function invalidateDeliveries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all });
}

export function useCreateDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      values: DeliveryFormValues;
      references: { containers: DeliveryContainerRef[]; employees: DeliveryEmployeeRef[] };
    }) => createDelivery(input.values, input.references),
    onSuccess: () => invalidateDeliveries(queryClient),
  });
}

export function useUpdateDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      deliveryId: number;
      values: DeliveryFormValues;
      references: { containers: DeliveryContainerRef[]; employees: DeliveryEmployeeRef[] };
    }) => updateDelivery(input.deliveryId, input.values, input.references),
    onSuccess: (_data, variables) => {
      invalidateDeliveries(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.detail(variables.deliveryId) });
    },
  });
}

export function useDeleteDeliveries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (deliveryIds: number[]) => deleteDeliveries(deliveryIds),
    onSuccess: () => invalidateDeliveries(queryClient),
  });
}

export function useAddInvoicesToDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { delivery: Delivery; invoices: Invoice[] }) => addInvoicesToDelivery(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.barcodes(variables.delivery.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.detail(variables.delivery.id) });
    },
  });
}
