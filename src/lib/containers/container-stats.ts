import type { TableFilterRowState } from "@/lib/table/filter-builder";

import {
  getDepartedContainerPeriodStartIso,
  type DepartedContainerStatPeriod,
} from "@/lib/containers/departed-container-stats";
import { DEFAULT_CONTAINER_LIST_PARAMS, type ContainerListParams } from "@/lib/containers/types";
import { getPreviousRollingPeriodBounds } from "@/lib/stats/rolling-period";

/**
 * Count-only container search requests for KPI cards.
 * The backend returns `total`; “departed containers” is filtered on `departureDate`.
 */
export const CONTAINER_STATS_COUNT_LIMIT = 1;

export function buildContainerStatsCountParams(
  filterRows: TableFilterRowState[],
): ContainerListParams {
  return {
    ...DEFAULT_CONTAINER_LIST_PARAMS,
    limit: CONTAINER_STATS_COUNT_LIMIT,
    filterRows,
  };
}

/**
 * Containers that already departed within the rolling window.
 * `departureDate <= now` excludes future scheduled departures.
 */
export function buildDepartedContainerStatsFilterRows(
  period: DepartedContainerStatPeriod,
  now: Date = new Date(),
): TableFilterRowState[] {
  return [
    {
      id: "departed-containers-departure-gte",
      join: "and",
      field: "departureDate",
      operator: "gte",
      value: getDepartedContainerPeriodStartIso(period, now),
    },
    {
      id: "departed-containers-departure-lte",
      join: "and",
      field: "departureDate",
      operator: "lte",
      value: now.toISOString(),
    },
  ];
}

/** Prior window of the same length, for period-over-period average value. */
export function buildPreviousDepartedContainerStatsFilterRows(
  period: DepartedContainerStatPeriod,
  now: Date = new Date(),
): TableFilterRowState[] {
  const { startIso, endIso } = getPreviousRollingPeriodBounds(period, now);

  return [
    {
      id: "departed-containers-previous-departure-gte",
      join: "and",
      field: "departureDate",
      operator: "gte",
      value: startIso,
    },
    {
      id: "departed-containers-previous-departure-lte",
      join: "and",
      field: "departureDate",
      operator: "lte",
      value: endIso,
    },
  ];
}
