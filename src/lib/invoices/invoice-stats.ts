import type { TableFilterRowState } from "@/lib/table/filter-builder";

import { DEFAULT_INVOICE_LIST_PARAMS, type InvoiceListParams } from "@/lib/invoices/types";

/** Count-only invoice list/search requests for dashboard stat cards. */
export const INVOICE_STATS_COUNT_LIMIT = 1;

export function buildInvoiceStatsCountParams(filterRows: TableFilterRowState[]): InvoiceListParams {
  return {
    ...DEFAULT_INVOICE_LIST_PARAMS,
    limit: INVOICE_STATS_COUNT_LIMIT,
    filterRows,
  };
}

export function buildOutstandingInvoiceStatsFilterRows(): TableFilterRowState[] {
  return [
    {
      id: "stats-outstanding-balance",
      join: "and",
      field: "balance",
      operator: "gt",
      value: "0",
    },
  ];
}
