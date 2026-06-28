import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import type { PaginatedApiEnvelope } from "@/lib/api/types";

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

/** `data` payload returned by `POST /reports/invoices`. */
export type InvoiceReportResult = {
  /** Identifier of the generated report. */
  reportId: string;
  /** Generated PDF file name. */
  fileName: string;
  /** Temporary public URL pointing at the generated PDF. */
  url: string;
  /** ISO timestamp marking when the public URL stops working. */
  expiresAt: string;
};

/** Payload accepted by `POST /reports/invoices`. */
export type InvoiceReportRequest = {
  /** Invoice identifiers to render. */
  invoices: string[];
  /** Field the API uses to resolve `invoices` (defaults to `id`). */
  lookupField?: string;
  /** Report type (defaults to `invoice`). */
  type?: string;
  /** How long the returned public URL stays valid (defaults to 24). */
  expiresInHours?: number;
};

/**
 * Generate a PDF invoice report for the requested invoices.
 *
 * Returns the report metadata, including a temporary public URL pointing at the
 * generated PDF.
 */
export async function generateInvoiceReport(
  request: InvoiceReportRequest,
): Promise<InvoiceReportResult> {
  const response = await apiClient.post<ApiMutationEnvelope<Partial<InvoiceReportResult>>>(
    API_ENDPOINTS.REPORTS_INVOICES,
    {
      invoices: request.invoices,
      lookup_field: request.lookupField ?? "id",
      type: request.type ?? "invoice",
      expiresInHours: request.expiresInHours ?? 24,
    },
  );

  if (response.success === false) {
    throw new Error(
      response.message?.trim() || response.error?.trim() || "Unable to generate invoice report.",
    );
  }

  const data = response.data;
  const url = typeof data?.url === "string" ? data.url.trim() : "";
  if (!url) {
    throw new Error("The invoice report did not return a download URL.");
  }

  return {
    reportId: data?.reportId ?? "",
    fileName: data?.fileName ?? "",
    url,
    expiresAt: data?.expiresAt ?? "",
  };
}
