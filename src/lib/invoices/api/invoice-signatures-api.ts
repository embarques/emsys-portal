import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { receiverSignatureSchema, type ReceiverSignature } from "@/lib/invoices/schemas/customer-signature.schema";

export async function saveInvoiceReceiverSignature(input: {
  /** Delivery assigned to the selected invoice barcode. */
  deliveryId: string;
  invoiceId: string;
  receiverSignature: ReceiverSignature;
}): Promise<void> {
  if (!/^\d+$/.test(input.deliveryId) || Number(input.deliveryId) <= 0 || Number(input.deliveryId) > 4294967295 || !input.invoiceId.trim()) throw new Error("An invoice and delivery are required.");
  const response = await apiClient.put<{ success?: boolean; message?: string; error?: string } | undefined>(
    API_ENDPOINTS.INVOICE_RECEIVER_SIGNATURE(input.deliveryId, input.invoiceId),
    { deliveryId: Number(input.deliveryId), receiverSignature: receiverSignatureSchema.parse(input.receiverSignature) },
  );
  if (response?.success === false) throw new Error(response.message || response.error || "Unable to save receiver signature.");
}
