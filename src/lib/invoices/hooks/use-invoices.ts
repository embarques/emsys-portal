"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  createInvoice,
  deleteInvoice,
  deleteInvoices,
  fetchInvoiceBalanceTotal,
  fetchInvoiceById,
  fetchInvoices,
  previewLegacyInvoiceSync,
  syncLegacyInvoices,
  updateInvoice,
  type InvoiceWriteContext,
} from "@/lib/invoices/api/invoices-api";
import {
  buildInvoiceStatsCountParams,
  buildNewInvoiceStatsFilterRows,
  buildOutstandingInvoiceStatsFilterRows,
} from "@/lib/invoices/invoice-stats";
import type { NewInvoiceStatPeriod } from "@/lib/invoices/new-invoice-stats";
import {
  DEFAULT_INVOICE_LIST_PARAMS,
  type InvoiceFormValues,
  type InvoiceListParams,
  type InvoiceSearchFilter,
  type LegacyInvoiceSyncRequest,
} from "@/lib/invoices/types";
import { queryKeys } from "@/lib/query/query-keys";

type InvoiceStatsOptions = {
  enabled?: boolean;
};

export function useInvoiceStats(options: InvoiceStatsOptions = {}) {
  const { enabled = true } = options;

  const outstandingFilterRows = buildOutstandingInvoiceStatsFilterRows();

  const outstandingQuery = useWorkspaceQuery({
    queryKey: queryKeys.invoices.stats("outstanding"),
    queryFn: () => fetchInvoices(buildInvoiceStatsCountParams(outstandingFilterRows)),
    enabled,
  });

  const outstandingBalanceQuery = useWorkspaceQuery({
    queryKey: queryKeys.invoices.stats("outstanding-balance"),
    queryFn: () => fetchInvoiceBalanceTotal(outstandingFilterRows),
    enabled,
  });

  return {
    outstanding: outstandingQuery.data?.total ?? 0,
    outstandingBalance: outstandingBalanceQuery.data ?? 0,
    isLoading: outstandingQuery.isLoading,
    isBalanceLoading: outstandingBalanceQuery.isLoading,
    isError: outstandingQuery.isError || outstandingBalanceQuery.isError,
  };
}

/** Count of invoices created within a rolling timeframe (`createdAt >= period start`). */
export function useNewInvoiceStats(period: NewInvoiceStatPeriod) {
  const query = useWorkspaceQuery({
    queryKey: queryKeys.invoices.stats("new", period),
    queryFn: () =>
      fetchInvoices(buildInvoiceStatsCountParams(buildNewInvoiceStatsFilterRows(period))),
  });

  return {
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
}

export function useInvoiceSearch(
  search: InvoiceSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useWorkspaceQuery({
    queryKey: queryKeys.invoices.search(search, limit),
    queryFn: () =>
      fetchInvoices({
        ...DEFAULT_INVOICE_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useInvoices(params: InvoiceListParams, options: { enabled?: boolean } = {}) {
  return useWorkspaceQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: () => fetchInvoices(params),
    enabled: options.enabled ?? true,
  });
}

export function useInvoice(invoiceId: string | null, enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.invoices.detail(invoiceId ?? ""),
    queryFn: () => fetchInvoiceById(invoiceId!),
    enabled: enabled && Boolean(invoiceId?.trim()),
  });
}

function invalidateInvoices(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { values: InvoiceFormValues; context: InvoiceWriteContext }) =>
      createInvoice(input.values, input.context),
    onSuccess: () => invalidateInvoices(queryClient),
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { invoiceId: string; values: InvoiceFormValues; context: InvoiceWriteContext }) =>
      updateInvoice(input.invoiceId, input.values, input.context),
    onSuccess: (invoice) =>
      Promise.all([
        invalidateInvoices(queryClient),
        queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(invoice.invoiceId) }),
      ]),
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoiceId: string) => deleteInvoice(invoiceId),
    onSuccess: () => invalidateInvoices(queryClient),
  });
}

export function useDeleteInvoices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invoiceIds: string[]) => deleteInvoices(invoiceIds),
    onSuccess: () => invalidateInvoices(queryClient),
  });
}

export function usePreviewLegacyInvoiceSync() {
  return useMutation({
    mutationFn: () => previewLegacyInvoiceSync(),
  });
}

export function useSyncLegacyInvoices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: LegacyInvoiceSyncRequest = {}) => syncLegacyInvoices(request),
    onSuccess: () => invalidateInvoices(queryClient),
  });
}
