import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { getConfiguredApiBaseUrl } from "@/lib/api/base-url";
import type { PaginatedApiEnvelope } from "@/lib/api/types";
import type {
  NormalizedReportRequest,
  ReportDefinition,
  ReportGenerationBoundaryResult,
  ReportRequest,
  ReportResult,
} from "@/lib/reports/types";

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

/** `data` may arrive as a bare URL string or a metadata object. */
type ReportData = string | Partial<ReportResult> | null | undefined;

type ApiReportDefinition = {
  id?: string;
  key?: string;
  type?: string;
  name?: string;
  description?: string;
  icon?: string;
  enabled?: boolean;
  sortOrder?: number;
  filters?: unknown;
};

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
    values: request.values ?? [],
    lookup_field: request.lookupField ?? "id",
    filters: request.filters,
    operator: request.operator,
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

/** Generate an employee loan report (`POST /reports/loans`). */
export function generateLoanReport(request: ReportRequest): Promise<ReportResult> {
  return postReport(API_ENDPOINTS.REPORTS_LOANS, request);
}

/** Generate invoice/barcode labels (`POST /reports/labels`). */
export function generateLabelReport(request: ReportRequest): Promise<ReportResult> {
  return postReport(API_ENDPOINTS.REPORTS_LABELS, request);
}

/** Generate a pickup manifest (`POST /reports/pickups`). */
export function generatePickupReport(request: ReportRequest): Promise<ReportResult> {
  return postReport(API_ENDPOINTS.REPORTS_PICKUPS, request);
}

/** Generate a delivery route report (`POST /reports/deliveries`). */
export function generateDeliveryReport(request: ReportRequest): Promise<ReportResult> {
  return postReport(API_ENDPOINTS.REPORTS_DELIVERIES, request);
}

function normalizeReportDefinition(raw: unknown): ReportDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as ApiReportDefinition;
  const key = String(item.key ?? "").trim();
  const name = String(item.name ?? "").trim();
  if (!key || !name) return null;

  return {
    id: String(item.id ?? key).trim() || key,
    key,
    type: String(item.type ?? "").trim(),
    name,
    description: String(item.description ?? "").trim(),
    icon: String(item.icon ?? "").trim() || undefined,
    enabled: item.enabled !== false,
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 0,
    filters: Array.isArray(item.filters)
      ? item.filters.map((filter) => String(filter ?? "").trim()).filter(Boolean)
      : [],
  };
}

export async function fetchReportDefinitions(): Promise<ReportDefinition[]> {
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(API_ENDPOINTS.REPORTS);
  return Array.isArray(response.data)
    ? response.data
        .map(normalizeReportDefinition)
        .filter((report): report is ReportDefinition => report != null)
    : [];
}

export async function requestReportGeneration(
  request: NormalizedReportRequest,
): Promise<ReportGenerationBoundaryResult> {
  if (process.env.NODE_ENV !== "production") {
    console.info("[Reports Portal] Phase 1 normalized report request", request);
  }

  return { status: "not-implemented", request };
}

/**
 * Build the absolute URL for downloading a public report by token
 * (`GET /public/reports/{token}`).
 */
export function buildPublicReportUrl(token: string): string {
  const base = getConfiguredApiBaseUrl();
  return `${base}${API_ENDPOINTS.REPORTS_PUBLIC}/${encodeURIComponent(token)}`;
}
