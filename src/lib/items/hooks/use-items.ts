"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createItem,
  deleteItem,
  deleteItems,
  fetchItemById,
  fetchItems,
  updateItem,
} from "@/lib/items/api/items-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import {
  DEFAULT_ITEM_LIST_PARAMS,
  type ItemFormValues,
  type ItemListParams,
  type ItemSearchFilter,
} from "@/lib/items/types";
import { queryKeys } from "@/lib/query/query-keys";

function isItemListFiltered(params: ItemListParams): boolean {
  return hasListTextSearch(params.search) || (params.filterRows ?? []).length > 0;
}

export function useItems(params: ItemListParams, options: { enabled?: boolean } = {}) {
  const isFiltered = isItemListFiltered(params);

  return useQuery({
    queryKey: queryKeys.items.list(params),
    queryFn: () => fetchItems(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useItemSearch(
  search: ItemSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useQuery({
    queryKey: queryKeys.items.search(search, limit),
    queryFn: () =>
      fetchItems({
        ...DEFAULT_ITEM_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useItemStats() {
  const totalQuery = useQuery({
    queryKey: queryKeys.items.stats("all"),
    queryFn: () => fetchItems({ ...DEFAULT_ITEM_LIST_PARAMS, limit: 1 }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    isLoading: totalQuery.isLoading,
    isError: totalQuery.isError,
  };
}

export function useItemKpis() {
  const query = useQuery({
    queryKey: queryKeys.items.stats("kpis"),
    queryFn: () => fetchItems({ ...DEFAULT_ITEM_LIST_PARAMS, limit: 200 }),
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useItem(itemId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.items.detail(itemId ?? ""),
    queryFn: () => fetchItemById(itemId!),
    enabled: enabled && Boolean(itemId),
  });
}

export function useItemPicker(limit = 200, options: { enabled?: boolean } = {}) {
  return useItems(
    {
      ...DEFAULT_ITEM_LIST_PARAMS,
      limit,
    },
    options,
  );
}

function invalidateItems(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ItemFormValues) => createItem(values),
    onSuccess: () => invalidateItems(queryClient),
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, values }: { itemId: string; values: ItemFormValues }) =>
      updateItem(itemId, values),
    onSuccess: (_data, variables) => {
      invalidateItems(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.items.detail(variables.itemId) });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => deleteItem(itemId),
    onSuccess: () => invalidateItems(queryClient),
  });
}

export function useDeleteItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemIds: string[]) => deleteItems(itemIds),
    onSuccess: () => invalidateItems(queryClient),
  });
}
