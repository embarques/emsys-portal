import type { TableFilterRowState } from "@/lib/table/filter-builder";

import {
  getNewInvoicePeriodStartIso,
  type NewInvoiceStatPeriod,
} from "@/lib/invoices/new-invoice-stats";
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
  // The API search allowlist does not include `balance`; outstanding invoices
  // are those whose paid status is not CLOSED (i.e. OPEN or PARTIAL).
  return [
    {
      id: "stats-outstanding-status",
      join: "and",
      field: "paidStatus",
      operator: "neq",
      value: "CLOSED",
    },
  ];
}

export function buildNewInvoiceStatsFilterRows(
  period: NewInvoiceStatPeriod,
): TableFilterRowState[] {
  return [
    {
      id: "new-invoices-created-at",
      join: "and",
      field: "createdAt",
      operator: "gte",
      value: getNewInvoicePeriodStartIso(period),
    },
  ];
}
