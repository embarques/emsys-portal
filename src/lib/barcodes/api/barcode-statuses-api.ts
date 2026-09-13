import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import type { BarcodeStatusOption } from "@/lib/labels/types";

export type BarcodeStatusFormValues = {
  name: string;
  prevStatus: string;
};

function normalizeStatus(raw: unknown): BarcodeStatusOption | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = Number(value.id);
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!Number.isFinite(id) || id <= 0 || !name) return null;
  const prevStatus = typeof value.prevStatus === "string" ? value.prevStatus.trim() : "";
  return { id, name, ...(prevStatus ? { prevStatus } : {}) };
}

function extractStatusList(data: unknown): BarcodeStatusOption[] {
  const value = unwrapApiData({ data } as ApiSuccessEnvelope<unknown>);
  const items = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : [];
  return items.map(normalizeStatus).filter((item): item is BarcodeStatusOption => item != null);
}

export async function fetchBarcodeStatuses(): Promise<BarcodeStatusOption[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(API_ENDPOINTS.BARCODE_STATUSES);
  return extractStatusList(response);
}

function buildPayload(values: BarcodeStatusFormValues) {
  return {
    name: values.name.trim(),
    ...(values.prevStatus.trim() ? { prevStatus: values.prevStatus.trim() } : {}),
  };
}

export async function createBarcodeStatus(values: BarcodeStatusFormValues): Promise<BarcodeStatusOption> {
  const response = await apiClient.post<ApiSuccessEnvelope<unknown>>(
    API_ENDPOINTS.BARCODE_STATUSES,
    buildPayload(values),
  );
  assertMutationSuccess(response, "Unable to create barcode status.");
  const status = normalizeStatus(unwrapApiData(response));
  if (!status) throw new Error("Unable to read the created barcode status.");
  return status;
}

export async function updateBarcodeStatus(
  id: number,
  values: BarcodeStatusFormValues,
): Promise<BarcodeStatusOption> {
  const response = await apiClient.put<ApiSuccessEnvelope<unknown>>(
    `${API_ENDPOINTS.BARCODE_STATUSES}/${id}`,
    buildPayload(values),
  );
  assertMutationSuccess(response, "Unable to update barcode status.");
  const status = normalizeStatus(unwrapApiData(response));
  if (!status) throw new Error("Unable to read the updated barcode status.");
  return status;
}

export async function deleteBarcodeStatus(id: number): Promise<void> {
  const response = await apiClient.delete<ApiSuccessEnvelope<unknown>>(
    `${API_ENDPOINTS.BARCODE_STATUSES}/${id}`,
  );
  assertMutationSuccess(response, "Unable to delete barcode status.");
}
