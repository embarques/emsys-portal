import { z } from "zod";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { invoiceSignatureOptionsSchema, MAX_SIGNATURE_PRINT_INVOICES } from "@/lib/invoices/schemas/invoice-print.schema";

const responseSchema = z.object({ data: z.array(invoiceSignatureOptionsSchema).max(MAX_SIGNATURE_PRINT_INVOICES) });
export async function fetchInvoiceSignatureOptions(invoiceIds: string[], signal?: AbortSignal) {
  if (invoiceIds.length === 0 || invoiceIds.length > MAX_SIGNATURE_PRINT_INVOICES) throw new Error("Choose between 1 and 100 invoices.");
  const response = await apiClient.post<{ success?: boolean; message?: string; error?: string; data?: unknown }>(
    API_ENDPOINTS.INVOICE_SIGNATURE_OPTIONS, { invoiceIds }, { signal },
  );
  if (response.success === false) throw new Error(response.message || response.error || "Unable to load signature choices.");
  const rows = responseSchema.parse(response).data;
  if (rows.length !== invoiceIds.length || new Set(rows.map((row) => row.invoiceId)).size !== invoiceIds.length || rows.some((row) => !invoiceIds.includes(row.invoiceId))) throw new Error("Signature choices do not match the selected invoices.");
  return rows;
}
