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
  outputs?: unknown;
};

function extractReportUrl(data: ReportData): string {
  if (typeof data === "string") return data.trim();
  if (data && typeof data.url === "string") return data.url.trim();
  return "";
}

/**
 * Shared poster for every `POST /reports/*` endpoint. They all accept the same
 * `{ type, collection, values, lookup_field }` body and return a temporary
 * public URL pointing at the generated file.
 */
async function postReport(endpoint: string, request: ReportRequest): Promise<ReportResult> {
  const payload = {
    type: request.type,
    collection: request.collection,
    values: request.values ?? [],
    lookup_field: request.lookupField ?? "id",
    filters: request.filters,
    operator: request.operator,
    format: request.format,
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

/** Generate a customs sender report (`POST /reports/custom/sender`). */
export function generateCustomsSenderReport(request: ReportRequest): Promise<ReportResult> {
  return postReport(API_ENDPOINTS.REPORTS_CUSTOM_SENDER, request);
}

function isLoanStatementReportKey(key: string): boolean {
  return key === "loan-statement" || key === "employee-loans";
}

function defaultReportOutputs(key: string): ReportDefinition["outputs"] {
  if (key === "customs-form") return ["excel"];
  if (key === "customs-invoices") return ["pdf", "excel"];
  if (isLoanStatementReportKey(key)) return ["pdf"];
  return ["pdf"];
}

function normalizeReportOutputs(raw: unknown, key: string): ReportDefinition["outputs"] {
  if (!Array.isArray(raw)) return defaultReportOutputs(key);
  const outputs: ReportDefinition["outputs"] = [];
  for (const item of raw) {
    const value = String(item ?? "").trim().toLowerCase();
    if (value === "pdf" || value === "excel") {
      if (!outputs.includes(value)) outputs.push(value);
    }
  }
  return outputs.length > 0 ? outputs : defaultReportOutputs(key);
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
    outputs: normalizeReportOutputs(item.outputs, key),
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

  if (request.reportKey === "customs-invoices") {
    const payload = buildCustomsSenderReportRequest(request);
    const result = await generateCustomsSenderReport(payload);
    return { status: "generated", request, result };
  }

  if (isLoanStatementReportKey(request.reportKey)) {
    const payload = buildLoanStatementReportRequest(request);
    const result = await generateLoanReport(payload);
    return { status: "generated", request, result };
  }

  return { status: "not-implemented", request };
}

function buildCustomsFormReportRequest(request: NormalizedReportRequest): ReportRequest {
  const containerId = request.filters.containerId?.trim();
  if (!containerId) {
    throw new Error("Container is required for the customs form report.");
  }

  return {
    type: "customs-form",
    collection: "containers",
    values: [containerId],
    lookupField: "id",
  };
}

function buildCustomsSenderReportRequest(request: NormalizedReportRequest): ReportRequest {
  const containerId = request.filters.containerId?.trim();
  if (!containerId) {
    throw new Error("Container is required for the customs sender report.");
  }

  return {
    type: "customs-sender",
    collection: "containers",
    values: [containerId],
    lookupField: "id",
    format: request.format ?? "pdf",
  };
}

function buildLoanStatementReportRequest(request: NormalizedReportRequest): ReportRequest {
  const employeeId = request.filters.employeeId?.trim();
  if (!employeeId) {
    throw new Error("Employee is required for the loan statement report.");
  }

  const dateFrom = request.filters.dateFrom?.trim().slice(0, 10) ?? "";
  const dateTo = request.filters.dateTo?.trim().slice(0, 10) ?? "";
  if (!dateFrom && !dateTo) {
    throw new Error("Date range is required for the loan statement report.");
  }

  const start = dateFrom || dateTo;
  const end = dateTo || dateFrom;
  const employeeValue = Number(employeeId);
  const filters: NonNullable<ReportRequest["filters"]> = [
    {
      field: "employee.id",
      operator: "eq",
      value: Number.isFinite(employeeValue) && employeeValue > 0 ? employeeValue : employeeId,
    },
  ];

  if (start === end) {
    filters.push({ field: "transactionDate", operator: "eq", value: start });
  } else {
    filters.push({ field: "transactionDate", operator: "gte", value: start });
    filters.push({ field: "transactionDate", operator: "lte", value: end });
  }

  return {
    type: "loan",
    collection: "loans",
    filters,
    operator: "and",
    format: "pdf",
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
  "customs-sender": generateCustomsSenderReport,
};

/** Dispatch a generate request to the matching `POST /reports/{type}` endpoint. */
export function generateReport(request: ReportRequest): Promise<ReportResult> {
  return REPORT_GENERATORS[request.type](request);
}
