"use client";

import { useMemo } from "react";
import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaginatedResult } from "@/lib/api/types";

import {
  cancelInventoryDispatch,
  cancelInventoryReceipt,
  createAndPostInventoryAdjustment,
  createInventoryDispatch,
  createInventoryHolder,
  createInventoryItem,
  createInventoryReceipt,
  createInventorySupplier,
  fetchHolderStock,
  fetchInventoryDispatches,
  fetchInventoryHolders,
  fetchInventoryItemById,
  fetchInventoryItems,
  fetchInventoryReceipts,
  fetchInventoryStock,
  fetchInventorySuppliers,
  fetchRouteCrews,
  postInventoryDispatch,
  postInventoryReceipt,
  setInventoryItemsActive,
  setInventorySuppliersActive,
  updateInventoryDispatch,
  updateInventoryItem,
  updateInventoryReceipt,
  updateInventorySupplier,
  type InventoryVersionedRef,
} from "@/lib/inventory/api/inventory-api";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { summarizeItemStock, type InventoryFormValues, type InventoryItem } from "@/lib/inventory/types/catalog";
import type { DispatchFormValues, ReceiptFormValues } from "@/lib/inventory/types/documents";
import type { InventoryHolderFormValues } from "@/lib/inventory/types/holders";
import {
  DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS,
  DEFAULT_INVENTORY_HOLDER_LIST_PARAMS,
  DEFAULT_INVENTORY_ITEM_LIST_PARAMS,
  DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS,
  DEFAULT_INVENTORY_STOCK_LIST_PARAMS,
  DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS,
  type InventoryListParams,
} from "@/lib/inventory/types/list";
import type { AdjustmentFormValues } from "@/lib/inventory/types/movements";
import { EMPTY_INVENTORY_SNAPSHOT } from "@/lib/inventory/types/snapshot";
import type { InventorySupplier, SupplierFormValues } from "@/lib/inventory/types/suppliers";

/** Inventory and the Supply operations workspace share the same ledger. */
function invalidateInventory(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
    queryClient.invalidateQueries({ queryKey: ["inventory-workflow"] }),
  ]);
}

export function useInventoryItems(params: InventoryListParams = DEFAULT_INVENTORY_ITEM_LIST_PARAMS) {
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.items(params),
    queryFn: async () => (await fetchInventoryItems(params)).items,
  });
}

export function useInventoryItem(itemId: string | undefined) {
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.item(itemId ?? ""),
    queryFn: () => fetchInventoryItemById(itemId!),
    enabled: Boolean(itemId),
  });
}

export function useInventoryStockBalances(params: InventoryListParams = DEFAULT_INVENTORY_STOCK_LIST_PARAMS) {
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.stock(params),
    queryFn: async () => (await fetchInventoryStock(params)).items,
  });
}

/** Company-wide available / quarantined / reserved quantity per item. */
export function useInventoryStockSummary() {
  const stockQuery = useInventoryStockBalances();
  const summaries = useMemo(() => summarizeItemStock(stockQuery.data ?? []), [stockQuery.data]);
  return { ...stockQuery, summaries };
}

export function useInventoryHolders(params: InventoryListParams = DEFAULT_INVENTORY_HOLDER_LIST_PARAMS) {
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.holders(params),
    queryFn: async () => (await fetchInventoryHolders(params)).items,
  });
}

export function useHolderStock(holderId: string | undefined) {
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.holderStock(holderId ?? ""),
    queryFn: () => fetchHolderStock(holderId!),
    enabled: Boolean(holderId),
  });
}

export function useRouteCrews(enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.routeCrews(),
    queryFn: fetchRouteCrews,
    enabled,
  });
}

export function useInventoryReceipts(params: InventoryListParams = DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS) {
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.receipts(params),
    queryFn: async () => (await fetchInventoryReceipts(params)).items,
  });
}

export function useInventoryDispatches(params: InventoryListParams = DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS) {
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.dispatches(params),
    queryFn: async () => (await fetchInventoryDispatches(params)).items,
  });
}

export function useInventorySuppliers(params: InventoryListParams = DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS) {
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.suppliers(params),
    queryFn: async () => (await fetchInventorySuppliers(params)).items,
  });
}

const INVENTORY_DIRECTORY_FETCHERS = {
  items: fetchInventoryItems,
  receipts: fetchInventoryReceipts,
  dispatches: fetchInventoryDispatches,
  suppliers: fetchInventorySuppliers,
} as const;

type InventoryDirectoryResource = keyof typeof INVENTORY_DIRECTORY_FETCHERS;
type InventoryDirectoryRecord<R extends InventoryDirectoryResource> = Awaited<
  ReturnType<(typeof INVENTORY_DIRECTORY_FETCHERS)[R]>
>["items"][number];

/** One server page of an inventory directory (search, filters and pagination applied by the API). */
export function useInventoryDirectoryPage<R extends InventoryDirectoryResource>(resource: R, params: InventoryListParams) {
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.directory(resource, params),
    queryFn: () =>
      INVENTORY_DIRECTORY_FETCHERS[resource](params) as Promise<PaginatedResult<InventoryDirectoryRecord<R>>>,
    placeholderData: keepPreviousData,
  });
}

export function useInventorySnapshot() {
  const itemsQuery = useInventoryItems();
  const receiptsQuery = useInventoryReceipts();
  const dispatchesQuery = useInventoryDispatches();
  const suppliersQuery = useInventorySuppliers();
  const holdersQuery = useInventoryHolders();
  const stockQuery = useInventoryStockBalances();

  const data = useMemo(
    () => ({
      items: itemsQuery.data ?? [],
      receipts: receiptsQuery.data ?? [],
      dispatches: dispatchesQuery.data ?? [],
      suppliers: suppliersQuery.data ?? [],
      holders: holdersQuery.data ?? [],
      stock: stockQuery.data ?? [],
    }),
    [dispatchesQuery.data, holdersQuery.data, itemsQuery.data, receiptsQuery.data, stockQuery.data, suppliersQuery.data],
  );

  const queries = [itemsQuery, receiptsQuery, dispatchesQuery, suppliersQuery, holdersQuery, stockQuery];
  return {
    data,
    isLoading: queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
  };
}

export function useInventorySnapshotData() {
  const { data } = useInventorySnapshot();
  return data ?? EMPTY_INVENTORY_SNAPSHOT;
}

function useInventoryMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useCreateInventoryItem() {
  return useInventoryMutation((values: InventoryFormValues) => createInventoryItem(values));
}

export function useUpdateInventoryItem() {
  return useInventoryMutation(({ item, values }: { item: InventoryItem; values: InventoryFormValues }) =>
    updateInventoryItem(item, values),
  );
}

export function useSetInventoryItemsActive() {
  return useInventoryMutation(({ items, isActive }: { items: InventoryItem[]; isActive: boolean }) =>
    setInventoryItemsActive(items, isActive),
  );
}

export function useCreateInventoryHolder() {
  return useInventoryMutation((values: InventoryHolderFormValues) => createInventoryHolder(values));
}

export function useCreateReceipt() {
  return useInventoryMutation((values: ReceiptFormValues) => createInventoryReceipt(values));
}

export function useUpdateReceipt() {
  return useInventoryMutation(({ receipt, values }: { receipt: InventoryVersionedRef; values: ReceiptFormValues }) =>
    updateInventoryReceipt(receipt, values),
  );
}

export function usePostReceipt() {
  return useInventoryMutation((receipt: InventoryVersionedRef) => postInventoryReceipt(receipt));
}

export function useCancelReceipt() {
  return useInventoryMutation((receipt: InventoryVersionedRef) => cancelInventoryReceipt(receipt));
}

export function useCreateDispatch() {
  return useInventoryMutation((values: DispatchFormValues) => createInventoryDispatch(values));
}

export function useUpdateDispatch() {
  return useInventoryMutation(({ dispatch, values }: { dispatch: InventoryVersionedRef; values: DispatchFormValues }) =>
    updateInventoryDispatch(dispatch, values),
  );
}

export function usePostDispatch() {
  return useInventoryMutation((dispatch: InventoryVersionedRef) => postInventoryDispatch(dispatch));
}

export function useCancelDispatch() {
  return useInventoryMutation((dispatch: InventoryVersionedRef) => cancelInventoryDispatch(dispatch));
}

export function useCreateAdjustment() {
  return useInventoryMutation((values: AdjustmentFormValues) => createAndPostInventoryAdjustment(values));
}

export function useCreateSupplier() {
  return useInventoryMutation((values: SupplierFormValues) => createInventorySupplier(values));
}

export function useUpdateSupplier() {
  return useInventoryMutation(({ supplier, values }: { supplier: InventorySupplier; values: SupplierFormValues }) =>
    updateInventorySupplier(supplier, values),
  );
}

export function useSetSuppliersActive() {
  return useInventoryMutation(({ suppliers, isActive }: { suppliers: InventorySupplier[]; isActive: boolean }) =>
    setInventorySuppliersActive(suppliers, isActive),
  );
}
