"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteInvoice,
  deleteInvoices,
  fetchInvoiceById,
  fetchInvoices,
} from "@/lib/invoices/api/invoices-api";
import {
  buildInvoiceStatsCountParams,
  buildOutstandingInvoiceStatsFilterRows,
} from "@/lib/invoices/invoice-stats";
import {
  DEFAULT_INVOICE_LIST_PARAMS,
  type InvoiceListParams,
  type InvoiceSearchFilter,
} from "@/lib/invoices/types";
import { queryKeys } from "@/lib/query/query-keys";

type InvoiceStatsOptions = {
  enabled?: boolean;
};

export function useInvoiceStats(options: InvoiceStatsOptions = {}) {
  const { enabled = true } = options;

  const outstandingQuery = useQuery({
    queryKey: queryKeys.invoices.stats("outstanding"),
    queryFn: () =>
      fetchInvoices(
        buildInvoiceStatsCountParams(buildOutstandingInvoiceStatsFilterRows()),
      ),
    enabled,
  });

  return {
    outstanding: outstandingQuery.data?.total ?? 0,
    isLoading: outstandingQuery.isLoading,
    isError: outstandingQuery.isError,
  };
}

export function useInvoiceSearch(
  search: InvoiceSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useQuery({
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
  return useQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: () => fetchInvoices(params),
    enabled: options.enabled ?? true,
  });
}

export function useInvoice(invoiceId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(invoiceId ?? ""),
    queryFn: () => fetchInvoiceById(invoiceId!),
    enabled: enabled && Boolean(invoiceId?.trim()),
  });
}

function invalidateInvoices(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
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
