import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import {
  completeDeliverySchema,
  completeDeliveryResultSchema,
  deliveryReviewSchema,
  type CompleteDeliveryInput,
} from "@/lib/deliveries/schemas/delivery-wizard.schema";
type Envelope = { success: boolean; data: unknown; message?: string };
function unwrap(response: Envelope) {
  if (!response.success)
    throw new Error(response.message || "Delivery request failed.");
  return response.data;
}
export async function fetchDeliveryReview(
  deliveryId: string,
  invoiceId: string,
  signal?: AbortSignal,
) {
  const response = await apiClient.get<Envelope>(
    API_ENDPOINTS.DELIVERY_REVIEW(deliveryId, invoiceId),
    { signal },
  );
  const result = deliveryReviewSchema.parse(unwrap(response));
  if (
    result.invoiceId !== invoiceId ||
    String(result.deliveryId) !== deliveryId
  )
    throw new Error(
      "Delivery items do not match the selected invoice and delivery.",
    );
  return result;
}
export async function completeDelivery(
  deliveryId: string,
  invoiceId: string,
  input: CompleteDeliveryInput,
) {
  const response = await apiClient.post<Envelope>(
    API_ENDPOINTS.DELIVERY_COMPLETE(deliveryId, invoiceId),
    completeDeliverySchema.parse(input),
  );
  const result = completeDeliveryResultSchema.parse(unwrap(response));
  if (
    result.invoiceId !== invoiceId ||
    String(result.deliveryId) !== deliveryId
  )
    throw new Error("Completion does not match the selected delivery.");
  return result;
}
