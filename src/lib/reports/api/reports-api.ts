import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { getConfiguredApiBaseUrl } from "@/lib/api/base-url";
import type { PaginatedApiEnvelope } from "@/lib/api/types";
import type { ReportRequest, ReportResult } from "@/lib/reports/types";

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

/** `data` may arrive as a bare URL string or a metadata object. */
type ReportData = string | Partial<ReportResult> | null | undefined;

function extractReportUrl(data: ReportData): string {
  if (typeof data === "string") return data.trim();
  if (data && typeof data.url === "string") return data.url.trim();
  return "";
}

/**
 * Shared poster for every `POST /reports/*` endpoint. They all accept the same
 * `{ type, collection, values, lookup_field }` body and return a temporary
 * public URL pointing at the generated PDF.
 */
async function postReport(endpoint: string, request: ReportRequest): Promise<ReportResult> {
  const response = await apiClient.post<ApiMutationEnvelope<ReportData>>(endpoint, {
    type: request.type,
    collection: request.collection,
    values: request.values,
    lookup_field: request.lookupField ?? "id",
    expiresInHours: request.expiresInHours ?? 24,
  });

  if (response.success === false) {
    throw new Error(
      response.message?.trim() || response.error?.trim() || "Unable to generate report.",
    );
  }

  const data = response.data;
  const url = extractReportUrl(data);
  if (!url) {
    throw new Error("The report did not return a download URL.");
  }

  const details = data && typeof data === "object" ? data : null;

  return {
    url,
    reportId: details?.reportId ?? "",
    fileName: details?.fileName ?? "",
    expiresAt: details?.expiresAt ?? "",
  };
}

/** Generate an income statement report (`POST /reports/income`). */
export function generateIncomeReport(request: ReportRequest): Promise<ReportResult> {
  return postReport(API_ENDPOINTS.REPORTS_INCOME, request);
}

/** Generate an invoice report (`POST /reports/invoices`). */
export function generateInvoiceReport(request: ReportRequest): Promise<ReportResult> {
  return postReport(API_ENDPOINTS.REPORTS_INVOICES, request);
}

/** Generate a journal report (`POST /reports/journals`). */
export function generateJournalReport(request: ReportRequest): Promise<ReportResult> {
  return postReport(API_ENDPOINTS.REPORTS_JOURNALS, request);
}

/** Generate invoice/barcode labels (`POST /reports/labels`). */
export function generateLabelReport(request: ReportRequest): Promise<ReportResult> {
  return postReport(API_ENDPOINTS.REPORTS_LABELS, request);
}

/** Generate a pickup manifest (`POST /reports/pickups`). */
export function generatePickupReport(request: ReportRequest): Promise<ReportResult> {
  return postReport(API_ENDPOINTS.REPORTS_PICKUPS, request);
}

/**
 * Build the absolute URL for downloading a public report by token
 * (`GET /public/reports/{token}`).
 */
export function buildPublicReportUrl(token: string): string {
  const base = getConfiguredApiBaseUrl();
  return `${base}${API_ENDPOINTS.REPORTS_PUBLIC}/${encodeURIComponent(token)}`;
}
