import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import type { PaginatedApiEnvelope } from "@/lib/api/types";

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

/** Which collection the `values` identifiers belong to. */
export type LabelReportCollection = "invoices" | "barcodes";

/** Payload accepted by `POST /reports/labels`. */
export type LabelReportRequest = {
  /** Identifiers to render labels for. */
  values: string[];
  /** Collection the `values` belong to (defaults to `invoices`). */
  collection?: LabelReportCollection;
  /** Field the API uses to resolve `values` (defaults to `id`). */
  lookupField?: string;
  /** Report type (defaults to `label`). */
  type?: string;
  /** How long the returned public URL stays valid (defaults to 24). */
  expiresInHours?: number;
};

/**
 * Generate 4x6 PDF labels for the requested invoices or barcodes.
 *
 * Returns a temporary public URL pointing at the generated PDF.
 */
export async function generateLabelReport(request: LabelReportRequest): Promise<string> {
  const response = await apiClient.post<ApiMutationEnvelope<string>>(API_ENDPOINTS.REPORTS_LABELS, {
    values: request.values,
    collection: request.collection ?? "invoices",
    lookup_field: request.lookupField ?? "id",
    type: request.type ?? "label",
    expiresInHours: request.expiresInHours ?? 24,
  });

  if (response.success === false) {
    throw new Error(
      response.message?.trim() || response.error?.trim() || "Unable to generate labels.",
    );
  }

  const url = typeof response.data === "string" ? response.data.trim() : "";
  if (!url) {
    throw new Error("The label report did not return a download URL.");
  }

  return url;
}
