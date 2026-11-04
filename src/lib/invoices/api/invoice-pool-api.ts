import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { invoicePoolPageSchema, reservedInvoiceSchema, type InvoicePoolAction } from "@/lib/invoices/schemas/invoice-pool.schema";

export async function fetchInvoicePool(employeeId: number | undefined, after: string | undefined, signal: AbortSignal) {
  const response = await apiClient.get<{ success: boolean; data: unknown }>(API_ENDPOINTS.INVOICE_POOL, { params: { employeeId, after, limit: 50 }, signal });
  assertMutationSuccess(response, "Unable to load reserved invoices");
  return invoicePoolPageSchema.parse(response.data);
}
export async function manageInvoicePool(request: InvoicePoolAction) {
  const response = await apiClient.post<{ success: boolean; data: unknown }>(API_ENDPOINTS.INVOICE_POOL_ACTIONS, request);
  assertMutationSuccess(response, "Unable to update reserved invoices");
  return z.array(reservedInvoiceSchema).parse(response.data);
}
