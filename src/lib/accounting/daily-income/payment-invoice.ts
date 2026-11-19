import axios from "axios";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import type { Invoice } from "@/lib/invoices/types";

export type PaymentInvoiceReference = Pick<Invoice, "invoiceId" | "invoiceNumber" | "cost" | "discount" | "amountPaid" | "balance">;
export type InvoicePaymentChoice = PaymentInvoiceReference & Partial<Pick<Invoice, "sender" | "receiver" | "lineItems">>;
type WireReference = { id: string; number: string; cost: number; discount: number; payment: number; balance: number };

/** Exact-number lookup, with no customer or responsibility fields. */
export async function fetchPaymentInvoiceReference(number: string, signal?: AbortSignal): Promise<{ invoice: PaymentInvoiceReference | null; unavailable: boolean }> {
  try {
    const payload = await apiClient.get<ApiSuccessEnvelope<WireReference>>(API_ENDPOINTS.ACCOUNTING_PAYMENT_INVOICE, { params: { number: number.trim() }, signal });
    const raw = unwrapApiData(payload);
    if (typeof raw?.id !== "string" || !raw.id || raw.number !== number.trim() || ![raw.cost, raw.discount, raw.payment, raw.balance].every(Number.isFinite)) {
      throw new Error("INVALID_PAYMENT_INVOICE_RESPONSE");
    }
    return { unavailable: false, invoice: { invoiceId: raw.id, invoiceNumber: raw.number,
      cost: raw.cost, discount: raw.discount, amountPaid: raw.payment, balance: raw.balance } };
  } catch (error) {
    if (axios.isAxiosError<{ message?: string }>(error) && error.response?.status === 404) {
      return { invoice: null, unavailable: error.response.data?.message !== "Invoice not found" };
    }
    throw error;
  }
}
