import type { TableFilterRowState } from "@/lib/table/filter-builder";

import {
  getNewCustomerPeriodStartIso,
  type NewCustomerStatPeriod,
} from "@/lib/customers/new-customer-stats";
import { DEFAULT_CUSTOMER_LIST_PARAMS, type CustomerListParams } from "@/lib/customers/types";
import { getPreviousRollingPeriodBounds } from "@/lib/stats/rolling-period";

/**
 * Count-only customer search requests for KPI cards.
 * The backend returns `total`; “new customers” is filtered on `createdAt`.
 */
export const CUSTOMER_STATS_COUNT_LIMIT = 1;

export function buildCustomerStatsCountParams(
  filterRows: TableFilterRowState[],
): CustomerListParams {
  return {
    ...DEFAULT_CUSTOMER_LIST_PARAMS,
    limit: CUSTOMER_STATS_COUNT_LIMIT,
    filterRows,
  };
}

export function buildNewCustomerStatsFilterRows(
  period: NewCustomerStatPeriod,
  now: Date = new Date(),
): TableFilterRowState[] {
  return [
    {
      id: "new-customers-created-at",
      join: "and",
      field: "createdAt",
      operator: "gte",
      value: getNewCustomerPeriodStartIso(period, now),
    },
  ];
}

/** Prior window of the same length, for period-over-period % change. */
export function buildPreviousNewCustomerStatsFilterRows(
  period: NewCustomerStatPeriod,
  now: Date = new Date(),
): TableFilterRowState[] {
  const { startIso, endIso } = getPreviousRollingPeriodBounds(period, now);

  return [
    {
      id: "new-customers-created-at-prev-gte",
      join: "and",
      field: "createdAt",
      operator: "gte",
      value: startIso,
    },
    {
      id: "new-customers-created-at-prev-lte",
      join: "and",
      field: "createdAt",
      operator: "lte",
      value: endIso,
    },
  ];
}
