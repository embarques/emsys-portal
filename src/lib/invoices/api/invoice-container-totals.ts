import { fetchInvoices } from "@/lib/invoices/api/invoices-api";
import { DEFAULT_INVOICE_LIST_PARAMS, getInvoiceTotal } from "@/lib/invoices/types";
import type { TableFilterRowState } from "@/lib/table/filter-builder";

const INVOICE_CONTAINER_TOTALS_PAGE_LIMIT = 200;
const INVOICE_CONTAINER_TOTALS_MAX_PAGES = 25;
const INVOICE_CONTAINER_ID_BATCH = 40;

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function parseContainerId(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildContainerIdBatchFilterRows(containerIds: number[]): TableFilterRowState[] {
  const rows: TableFilterRowState[] = containerIds.map((containerId, index) => ({
    id: `invoice-container-id-${containerId}`,
    join: index === 0 ? "and" : "or",
    field: "container.id",
    operator: "eq",
    value: String(containerId),
  }));

  rows.push({
    id: "invoice-container-not-void",
    join: "and",
    field: "isVoid",
    operator: "eq",
    value: "false",
  });

  return rows;
}

/**
 * Sums non-void invoice merchandise totals (`cost` / line totals) grouped by
 * `container.id`. Used by the containers average-value KPI until the API
 * exposes a money aggregation.
 */
export async function fetchInvoiceMerchandiseTotalsByContainerIds(
  containerIds: number[],
): Promise<Map<number, number>> {
  const totals = new Map<number, number>();
  const uniqueIds = [...new Set(containerIds.filter((id) => Number.isFinite(id) && id > 0))];

  for (let offset = 0; offset < uniqueIds.length; offset += INVOICE_CONTAINER_ID_BATCH) {
    const batch = uniqueIds.slice(offset, offset + INVOICE_CONTAINER_ID_BATCH);
    const allowed = new Set(batch);
    let page = 1;
    let total = Number.POSITIVE_INFINITY;
    let fetched = 0;

    while (fetched < total && page <= INVOICE_CONTAINER_TOTALS_MAX_PAGES) {
      const result = await fetchInvoices({
        ...DEFAULT_INVOICE_LIST_PARAMS,
        page,
        limit: INVOICE_CONTAINER_TOTALS_PAGE_LIMIT,
        filterRows: buildContainerIdBatchFilterRows(batch),
      });

      total = result.total;
      for (const invoice of result.items) {
        const containerId = parseContainerId(invoice.containerId);
        if (containerId == null || !allowed.has(containerId)) continue;
        totals.set(containerId, roundMoney((totals.get(containerId) ?? 0) + getInvoiceTotal(invoice)));
      }

      fetched += result.items.length;
      if (result.items.length === 0) break;
      page += 1;
    }
  }

  return totals;
}
