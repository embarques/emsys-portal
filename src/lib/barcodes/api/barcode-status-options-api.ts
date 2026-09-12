import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import {
  FALLBACK_BARCODE_STATUS_OPTIONS,
  type BarcodeStatusOption,
} from "@/lib/labels/types";

function asFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeBarcodeStatusOption(raw: unknown): BarcodeStatusOption | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = asFiniteNumber(value.id);
  const name = asString(value.name).trim();
  if (id <= 0 || !name) return null;
  const prevStatus = asString(value.prevStatus).trim();
  return {
    id,
    name,
    ...(prevStatus ? { prevStatus } : {}),
  };
}

/**
 * `GET /v1/barcodes/status-options` — tenant `barcode_statuses` catalog,
 * sorted by id. Requires labels view permission.
 */
export async function fetchBarcodeStatusOptions(): Promise<BarcodeStatusOption[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(
    API_ENDPOINTS.BARCODES_STATUS_OPTIONS,
  );
  const data = unwrapApiData(response);
  const rawItems = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : [];
  const items = rawItems
    .map(normalizeBarcodeStatusOption)
    .filter((item): item is BarcodeStatusOption => item != null);

  return items.length > 0 ? items : [...FALLBACK_BARCODE_STATUS_OPTIONS];
}
