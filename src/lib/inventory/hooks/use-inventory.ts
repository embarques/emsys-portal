"use client";

import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@/lib/i18n";
import {
  createInventoryDispatch,
  createInventoryItem,
  createInventoryReceipt,
  createInventorySupplier,
  deleteInventoryItems,
  deleteInventorySuppliers,
  fetchInventoryDispatches,
  fetchInventoryItemById,
  fetchInventoryItems,
  fetchInventoryReceipts,
  fetchInventoryStockById,
  fetchInventorySuppliers,
  updateInventoryItem,
  updateInventorySupplier,
} from "@/lib/inventory/api/inventory-api";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import type { InventoryFormValues } from "@/lib/inventory/types/catalog";
import type { DispatchFormValues, ReceiptFormValues } from "@/lib/inventory/types/documents";
import {
  DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS,
  DEFAULT_INVENTORY_ITEM_LIST_PARAMS,
  DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS,
  DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS,
  type InventoryListParams,
} from "@/lib/inventory/types/list";
import type { AdjustmentFormValues } from "@/lib/inventory/types/movements";
import { EMPTY_INVENTORY_SNAPSHOT } from "@/lib/inventory/types/snapshot";
import type { SupplierFormValues } from "@/lib/inventory/types/suppliers";
import { movementsFromInventoryDocuments } from "@/lib/inventory/utils/movements";

function invalidateInventory(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
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

export function useInventoryMovements(itemId?: string) {
  const receiptsQuery = useInventoryReceipts(itemId ? { ...DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS, itemId } : DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS);
  const dispatchesQuery = useInventoryDispatches(
    itemId ? { ...DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS, itemId } : DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS,
  );

  const movements = useMemo(() => {
    const receipts = itemId
      ? (receiptsQuery.data ?? []).filter((receipt) => receipt.itemId === itemId)
      : (receiptsQuery.data ?? []);
    const dispatches = itemId
      ? (dispatchesQuery.data ?? []).filter((dispatch) => dispatch.itemId === itemId)
      : (dispatchesQuery.data ?? []);
    return movementsFromInventoryDocuments(receipts, dispatches);
  }, [dispatchesQuery.data, itemId, receiptsQuery.data]);

  return {
    data: movements,
    isLoading: receiptsQuery.isLoading || dispatchesQuery.isLoading,
    isError: receiptsQuery.isError || dispatchesQuery.isError,
  };
}

export function useItemStock(itemId: string | undefined) {
  const itemsQuery = useInventoryItems();
  const stockFromItems = itemsQuery.data?.find((item) => item.id === itemId)?.quantity;

  const stockQuery = useWorkspaceQuery({
    queryKey: queryKeys.inventory.stock(itemId ?? ""),
    queryFn: async () => (await fetchInventoryStockById(itemId!)).quantity,
    enabled: Boolean(itemId) && stockFromItems == null,
  });

  return {
    ...stockQuery,
    data: stockFromItems ?? stockQuery.data ?? 0,
  };
}

export function useInventorySnapshot() {
  const itemsQuery = useInventoryItems();
  const receiptsQuery = useInventoryReceipts();
  const dispatchesQuery = useInventoryDispatches();
  const suppliersQuery = useInventorySuppliers();

  const data = useMemo(() => {
    const items = itemsQuery.data ?? [];
    const receipts = receiptsQuery.data ?? [];
    const dispatches = dispatchesQuery.data ?? [];
    const suppliers = suppliersQuery.data ?? [];
    return {
      items,
      receipts,
      dispatches,
      suppliers,
      movements: movementsFromInventoryDocuments(receipts, dispatches),
    };
  }, [dispatchesQuery.data, itemsQuery.data, receiptsQuery.data, suppliersQuery.data]);

  return {
    data,
    isLoading:
      itemsQuery.isLoading || receiptsQuery.isLoading || dispatchesQuery.isLoading || suppliersQuery.isLoading,
    isError: itemsQuery.isError || receiptsQuery.isError || dispatchesQuery.isError || suppliersQuery.isError,
  };
}

export function useInventorySnapshotData() {
  const { data } = useInventorySnapshot();
  return data ?? EMPTY_INVENTORY_SNAPSHOT;
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: InventoryFormValues) => createInventoryItem(values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: InventoryFormValues }) => updateInventoryItem(id, values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useDeleteInventoryItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteInventoryItems(ids),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useCreateReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ReceiptFormValues) => createInventoryReceipt(values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useCreateDispatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: DispatchFormValues) => createInventoryDispatch(values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useCreateAdjustment() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (values: AdjustmentFormValues): Promise<never> => {
      void values;
      throw new Error(t("inventory.errors.adjustmentsUnavailable"));
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: SupplierFormValues) => createInventorySupplier(values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: SupplierFormValues }) => updateInventorySupplier(id, values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useDeleteSuppliers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteInventorySuppliers(ids),
    onSuccess: () => invalidateInventory(queryClient),
  });
}
