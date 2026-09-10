import { fetchContainers } from "@/lib/containers/api/containers-api";
import {
  computeAverageMerchandiseValuePerContainer,
  roundContainerMoney,
  type AverageContainerValueStats,
} from "@/lib/containers/average-container-value";
import { buildDepartedContainerStatsFilterRows } from "@/lib/containers/container-stats";
import type { DepartedContainerStatPeriod } from "@/lib/containers/departed-container-stats";
import { DEFAULT_CONTAINER_LIST_PARAMS, type Container } from "@/lib/containers/types";
import { fetchInvoiceMerchandiseTotalsByContainerIds } from "@/lib/invoices/api/invoice-container-totals";
import type { TableFilterRowState } from "@/lib/table/filter-builder";

const CONTAINER_VALUE_PAGE_LIMIT = 200;
const CONTAINER_VALUE_MAX_PAGES = 50;

/**
 * The EMSYS API does not expose a merchandise-value aggregation per container,
 * so this KPI paginates departed containers and their invoices client-side.
 */
async function fetchMatchingContainers(filterRows: TableFilterRowState[]): Promise<Container[]> {
  const items: Container[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (items.length < total && page <= CONTAINER_VALUE_MAX_PAGES) {
    const result = await fetchContainers({
      ...DEFAULT_CONTAINER_LIST_PARAMS,
      page,
      limit: CONTAINER_VALUE_PAGE_LIMIT,
      filterRows,
    });

    total = result.total;
    items.push(...result.items);
    if (result.items.length === 0) break;
    page += 1;
  }

  return items;
}

async function computeAverageForDepartedWindow(
  filterRows: TableFilterRowState[],
): Promise<{ average: number; containerCount: number }> {
  const containers = await fetchMatchingContainers(filterRows);
  if (containers.length === 0) {
    return { average: 0, containerCount: 0 };
  }

  const totalsByContainer = await fetchInvoiceMerchandiseTotalsByContainerIds(
    containers.map((container) => container.id),
  );
  const totalValue = containers.reduce(
    (sum, container) => sum + (totalsByContainer.get(container.id) ?? 0),
    0,
  );

  return {
    average: computeAverageMerchandiseValuePerContainer(containers.length, totalValue),
    containerCount: containers.length,
  };
}

export async function fetchAverageContainerValueStats(
  period: DepartedContainerStatPeriod,
  now: Date = new Date(),
): Promise<AverageContainerValueStats> {
  const current = await computeAverageForDepartedWindow(
    buildDepartedContainerStatsFilterRows(period, now),
  );

  return {
    average: roundContainerMoney(current.average),
    containerCount: current.containerCount,
  };
}
