import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { invoicePoolPageSchema, reservedInvoiceSchema, type InvoicePoolAction } from "@/lib/invoices/schemas/invoice-pool.schema";

import { buildInvoicePoolSearchBody, INVOICE_POOL_FILTER_FIELDS } from "@/lib/invoices/invoice-pool-filters";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";

export async function fetchInvoicePool(userId: number | undefined, after: string | undefined, signal: AbortSignal, search?: string, rows: TableFilterRowState[] = []) {
  if (rows.some(row => isCompleteFilterRow(row, INVOICE_POOL_FILTER_FIELDS))) {
    const response = await apiClient.post<{ success: boolean; data: unknown }>(API_ENDPOINTS.INVOICE_POOL_SEARCH,
      buildInvoicePoolSearchBody(rows, search), { params: { after, limit: 50 }, signal });
    assertMutationSuccess(response, "Unable to search reserved invoices");
    return invoicePoolPageSchema.parse(response.data);
  }
  const response = await apiClient.get<{ success: boolean; data: unknown }>(API_ENDPOINTS.INVOICE_POOL, { params: { userId, after, limit: 50, q: search?.trim() || undefined }, signal });
  assertMutationSuccess(response, "Unable to load reserved invoices");
  return invoicePoolPageSchema.parse(response.data);
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
