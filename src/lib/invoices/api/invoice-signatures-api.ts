import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { receiverSignatureSchema, type ReceiverSignature } from "@/lib/invoices/schemas/customer-signature.schema";

export async function saveInvoiceReceiverSignature(input: {
  /** The DR daily route (`/vehicle-routes` id) is the delivery. */
  dailyRouteId: string;
  invoiceId: string;
  receiverSignature: ReceiverSignature;
}): Promise<void> {
  if (!input.dailyRouteId.trim() || !input.invoiceId.trim()) throw new Error("An invoice and daily route are required.");
  const response = await apiClient.put<{ success?: boolean; message?: string; error?: string } | undefined>(
    API_ENDPOINTS.INVOICE_RECEIVER_SIGNATURE(input.dailyRouteId, input.invoiceId),
    { receiverSignature: receiverSignatureSchema.parse(input.receiverSignature) },
  );
  if (response?.success === false) throw new Error(response.message || response.error || "Unable to save receiver signature.");
}
