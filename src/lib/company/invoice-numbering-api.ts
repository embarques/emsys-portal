import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

export type InvoiceNumbering = {
  prefix: string;
  suffix: string;
  startValue: string;
  maxValue: string;
  lastUsedValue: string;
  paddingLength: number;
  isActive: boolean;
};

export type InvoiceNumberingUpdate = Omit<InvoiceNumbering, "lastUsedValue" | "suffix"> & { suffix?: string };

export async function fetchInvoiceNumbering(signal: AbortSignal) {
  const response = await apiClient.get<{ data: InvoiceNumbering }>(API_ENDPOINTS.COMPANY_INVOICE_NUMBERING, { signal });
  return response.data;
}

export async function updateInvoiceNumbering(input: InvoiceNumberingUpdate) {
  const response = await apiClient.put<{ data: InvoiceNumbering }>(API_ENDPOINTS.COMPANY_INVOICE_NUMBERING, input);
  return response.data;
}
