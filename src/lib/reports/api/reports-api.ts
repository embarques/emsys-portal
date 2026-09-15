import { isAxiosError } from "axios";

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
  ReportType,
} from "@/lib/reports/types";

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

/** `data` may arrive as a bare URL string or a metadata object. */
type ReportData = string | Partial<ReportResult> | null | undefined;

type ApiReportDefinition = {
  createdAt?: string;
  updatedAt?: string;
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
  const payload = {
    type: request.type,
    collection: request.collection,
    values: request.values ?? [],
    lookup_field: request.lookupField ?? "id",
    filters: request.filters,
    operator: request.operator,
    expiresInHours: request.expiresInHours ?? 24,
  };

  if (process.env.NODE_ENV !== "production") {
    console.info("[Reports Portal] Sending report request", { endpoint, payload });
  }

  let response: ApiMutationEnvelope<ReportData>;
  try {
    response = await apiClient.post<ApiMutationEnvelope<ReportData>>(endpoint, payload);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[Reports Portal] Report request failed", {
        endpoint,
        payload,
        error: isAxiosError(error)
          ? {
              message: error.message,
              status: error.response?.status,
              responseData: error.response?.data,
            }
          : error,
      });
    }
    throw error;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[Reports Portal] Received report response", { endpoint, response });
  }

  if (response.success === false) {
    throw new Error(
      response.message?.trim() || response.error?.trim() || "Unable to generate report.",
    );
  }

  const data = response.data;
  const url = extractReportUrl(data);
  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[Reports Portal] Report response did not include a URL", {
        endpoint,
        response,
      });
    }
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

/** Generate a customs form report (`POST /reports/custom/form`). */
export function generateCustomsFormReport(request: ReportRequest): Promise<ReportResult> {
  return postReport(API_ENDPOINTS.REPORTS_CUSTOM_FORM, request);
}

function normalizeReportDefinition(raw: unknown): ReportDefinition | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as ApiReportDefinition;
  const key = String(item.key ?? "").trim();
  const name = String(item.name ?? "").trim();
  if (!key || !name) return null;

  return {
    createdAt: String(item.createdAt ?? "").trim(),
    updatedAt: String(item.updatedAt ?? "").trim(),
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
    console.info("[Reports Portal] Normalized report request", request);
  }

  if (request.reportKey === "customs-form") {
    const payload = buildCustomsFormReportRequest(request);
    const result = await generateCustomsFormReport(payload);
    return { status: "generated", request, result };
  }

  return { status: "not-implemented", request };
}

function buildCustomsFormReportRequest(request: NormalizedReportRequest): ReportRequest {
  const containerId = request.filters.containerId?.trim();
  if (!containerId) {
    throw new Error("Container is required for the customs form report.");
  }

  const filters: NonNullable<ReportRequest["filters"]> = [];
  const customerId = request.filters.customerId?.trim();
  if (customerId) {
    filters.push({ field: "customer.id", operator: "eq", value: customerId });
  }
  const locationId = request.filters.locationId?.trim();
  if (locationId) {
    filters.push({ field: "branch.id", operator: "eq", value: Number(locationId) || locationId });
  }
  const paymentStatus = request.filters.paymentStatus?.trim();
  if (paymentStatus) {
    filters.push({ field: "paidStatus", operator: "eq", value: paymentStatus });
  }

  return {
    type: "customs-form",
    collection: "containers",
    values: [containerId],
    lookupField: "id",
    operator: filters.length > 0 ? "and" : undefined,
    filters: filters.length > 0 ? filters : undefined,
  };
}

/**
 * Build the absolute URL for downloading a public report by token
 * (`GET /public/reports/{token}`).
 */
export function buildPublicReportUrl(token: string): string {
  const base = getConfiguredApiBaseUrl();
  return `${base}${API_ENDPOINTS.REPORTS_PUBLIC}/${encodeURIComponent(token)}`;
}

const REPORT_GENERATORS: Record<ReportType, (request: ReportRequest) => Promise<ReportResult>> = {
  income: generateIncomeReport,
  invoice: generateInvoiceReport,
  journal: generateJournalReport,
  loan: generateLoanReport,
  label: generateLabelReport,
  pickup: generatePickupReport,
  delivery: generateDeliveryReport,
  "customs-form": generateCustomsFormReport,
};

/** Dispatch a generate request to the matching `POST /reports/{type}` endpoint. */
export function generateReport(request: ReportRequest): Promise<ReportResult> {
  return REPORT_GENERATORS[request.type](request);
}
