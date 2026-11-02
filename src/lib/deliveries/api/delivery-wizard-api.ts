import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { translateCurrent } from "@/lib/i18n/translate-current";
import {
  completeDeliverySchema,
  completeDeliveryResultSchema,
  deliveryReviewSchema,
  type CompleteDeliveryInput,
} from "@/lib/deliveries/schemas/delivery-wizard.schema";
type Envelope = { success: boolean; data: unknown; message?: string };
function unwrap(response: Envelope) {
  if (!response.success)
    throw new Error(response.message || translateCurrent("deliveries.errors.requestFailed"));
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
    throw new Error(translateCurrent("deliveries.errors.reviewMismatch"));
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
    throw new Error(translateCurrent("deliveries.errors.completionMismatch"));
  return result;
}
