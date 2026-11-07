import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { invoicePoolPageSchema, reservedInvoiceSchema, type InvoicePoolAction } from "@/lib/invoices/schemas/invoice-pool.schema";

import { buildInvoicePoolSearchBody } from "@/lib/invoices/invoice-pool-filters";
import type { TableFilterRowState } from "@/lib/table/filter-builder";

const POOL_PAGE_SIZE = 50;

export async function fetchInvoicePool(page: number, sort: string, signal: AbortSignal, search?: string, rows: TableFilterRowState[] = []) {
  const response = await apiClient.post<{ success: boolean; data: unknown; total: number }>(
    API_ENDPOINTS.INVOICE_POOL_SEARCH,
    buildInvoicePoolSearchBody(rows, search, sort),
    { params: { page, limit: POOL_PAGE_SIZE }, signal },
  );
  assertMutationSuccess(response, "Unable to search reserved invoices");
  return {
    items: z.array(reservedInvoiceSchema).parse(response.data),
    remaining: response.total,
    hasNext: page * POOL_PAGE_SIZE < response.total,
  };
}
/** Unassigned company-pool count plus the requester's low-invoice warning threshold. */
export async function fetchInvoicePoolSummary(signal: AbortSignal) {
  const response = await apiClient.get<{ success: boolean; data: unknown }>(API_ENDPOINTS.INVOICE_POOL, { params: { userId: 0, limit: 1 }, signal });
  assertMutationSuccess(response, "Unable to load reserved invoices");
  const page = invoicePoolPageSchema.parse(response.data);
  return { remaining: page.remaining, lowThreshold: page.lowThreshold };
}
export async function manageInvoicePool(request: InvoicePoolAction) {
  const response = await apiClient.post<{ success: boolean; data: unknown }>(API_ENDPOINTS.INVOICE_POOL_ACTIONS, request);
  assertMutationSuccess(response, "Unable to update reserved invoices");
  return z.array(reservedInvoiceSchema).parse(response.data);
}
