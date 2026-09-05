import type { TableFilterRowState } from "@/lib/table/filter-builder";

import {
  getNewInvoicePeriodStartIso,
  type NewInvoiceStatPeriod,
} from "@/lib/invoices/new-invoice-stats";
import { DEFAULT_INVOICE_LIST_PARAMS, type InvoiceListParams } from "@/lib/invoices/types";
import { getPreviousRollingPeriodBounds } from "@/lib/stats/rolling-period";

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
  now: Date = new Date(),
): TableFilterRowState[] {
  return [
    {
      id: "new-invoices-created-at",
      join: "and",
      field: "createdAt",
      operator: "gte",
      value: getNewInvoicePeriodStartIso(period, now),
    },
  ];
}

/** Prior window of the same length, for period-over-period % change. */
export function buildPreviousNewInvoiceStatsFilterRows(
  period: NewInvoiceStatPeriod,
  now: Date = new Date(),
): TableFilterRowState[] {
  const { startIso, endIso } = getPreviousRollingPeriodBounds(period, now);

  return [
    {
      id: "new-invoices-created-at-prev-gte",
      join: "and",
      field: "createdAt",
      operator: "gte",
      value: startIso,
    },
    {
      id: "new-invoices-created-at-prev-lte",
      join: "and",
      field: "createdAt",
      operator: "lte",
      value: endIso,
    },
  ];
}
