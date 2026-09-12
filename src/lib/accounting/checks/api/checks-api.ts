import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import {
  runSettledIdsWithConcurrency,
  type BulkSettledResult,
} from "@/lib/api/run-settled-with-concurrency";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  hasResourceListFilters,
} from "@/lib/api/search-query";
import { CHECK_BAR_OR_SEARCH_FIELDS } from "@/lib/accounting/checks/search-fields";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import {
  DEFAULT_CHECK_LIST_PARAMS,
  parseCheckPaymentAmount,
  type Check,
  type CheckFormValues,
  type CheckInvoiceRef,
  type CheckListParams,
  type CheckStatus,
} from "@/lib/accounting/checks/types";

type ApiUser = {
  id?: number;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiCheckInvoice = {
  id?: string;
  number?: string;
  cost?: number;
  discount?: number;
  payment?: number;
  balance?: number;
};

type ApiCheckJournal = {
  id?: string;
};

type ApiCheck = {
  id?: string;
  checkNumber?: string;
  refNumber?: string;
  paymentAmount?: number;
  datePosted?: string;
  clearedAt?: string;
  status?: string;
  invoice?: ApiCheckInvoice | null;
  journal?: ApiCheckJournal | null;
  createdAt?: string;
  createdBy?: ApiUser | string;
  updatedAt?: string;
  updatedBy?: ApiUser | string;
};

type ApiCheckWritePayload = {
  id?: string;
  checkNumber: string;
  paymentAmount: number;
  invoice: { id: string; number?: string };
  refNumber?: string;
  datePosted?: string;
  status?: CheckStatus;
  clearedAt?: string;
  journal?: { id: string };
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function hasCheckListFilters(params: CheckListParams): boolean {
  return hasResourceListFilters({
    search: params.search,
  });
}

function buildCheckSearchBody(params: CheckListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_CHECK_LIST_PARAMS.sort,
    filterGroups: buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: CHECK_BAR_OR_SEARCH_FIELDS,
      tableFilterFields: [],
    }),
  });
}

function buildChecksQuery(params: CheckListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_CHECK_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_CHECK_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_CHECK_LIST_PARAMS.sort,
  });
}

function readStringId(value: unknown): string | undefined {
  if (value == null) return undefined;
  const id = String(value).trim();
  return id || undefined;
}

function readUserName(user: unknown): string {
  if (!user) return "";
  if (typeof user === "string") return user.trim();
  if (typeof user === "object") {
    const entry = user as ApiUser;
    return String(entry.fullName ?? entry.userName ?? entry.name ?? "").trim();
  }
  return "";
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** API `time.Time` fields reject date-only strings; send RFC3339 midnight UTC. */
function toCheckApiDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00Z`;
}

function normalizeCheckStatus(value: unknown): CheckStatus {
  return String(value ?? "").trim().toUpperCase() === "CLEARED" ? "CLEARED" : "OUTSTANDING";
}

function normalizeInvoice(raw: ApiCheckInvoice | null | undefined): CheckInvoiceRef {
  return {
    id: readStringId(raw?.id) ?? "",
    number: String(raw?.number ?? "").trim(),
    cost: raw?.cost == null ? undefined : numberValue(raw.cost),
    discount: raw?.discount == null ? undefined : numberValue(raw.discount),
    payment: raw?.payment == null ? undefined : numberValue(raw.payment),
    balance: raw?.balance == null ? undefined : numberValue(raw.balance),
  };
}

export function normalizeCheck(raw: unknown): Check | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiCheck;
  const id = readStringId(item.id);
  if (!id) return null;

  const invoice = normalizeInvoice(item.invoice);
  const journalId = readStringId(item.journal?.id);

  return {
    id,
    status: normalizeCheckStatus(item.status),
    checkNumber: String(item.checkNumber ?? "").trim(),
    refNumber: String(item.refNumber ?? "").trim(),
    paymentAmount: numberValue(item.paymentAmount),
    datePosted: String(item.datePosted ?? "").trim(),
    clearedAt: String(item.clearedAt ?? "").trim(),
    invoice,
    journalId,
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readUserName(item.createdBy),
    updatedAt: String(item.updatedAt ?? "").trim() || undefined,
    updatedBy: readUserName(item.updatedBy) || undefined,
  };
}

function normalizePaginatedChecks(
  payload: PaginatedApiEnvelope<unknown[]>,
  context: { isFiltered?: boolean } = {},
): PaginatedResult<Check> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeCheck).filter((check): check is Check => check != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, context),
  };
}

export function buildCheckWritePayload(
  values: CheckFormValues,
  options: { recordId?: string; journalId?: string } = {},
): ApiCheckWritePayload {
  const invoiceId = values.invoiceId.trim();
  const checkNumber = values.checkNumber.trim();
  const paymentAmount = parseCheckPaymentAmount(values.paymentAmount);
  if (!invoiceId) {
    throw new Error("Invoice is required.");
  }
  if (!checkNumber) {
    throw new Error("Check number is required.");
  }
  if (paymentAmount == null) {
    throw new Error("Payment amount is required.");
  }

  const payload: ApiCheckWritePayload = {
    invoice: {
      id: invoiceId,
      ...(values.invoiceNumber.trim() ? { number: values.invoiceNumber.trim() } : {}),
    },
    checkNumber,
    paymentAmount,
    status: values.status,
  };

  const refNumber = values.refNumber.trim();
  if (refNumber) payload.refNumber = refNumber;

  const datePosted = toCheckApiDate(values.datePosted);
  if (datePosted) payload.datePosted = datePosted;

  if (values.status === "CLEARED") {
    const clearedAt = toCheckApiDate(values.clearedAt) ?? datePosted;
    if (clearedAt) payload.clearedAt = clearedAt;
  }

  if (options.recordId) payload.id = options.recordId;
  if (options.journalId) payload.journal = { id: options.journalId };

  return payload;
}

function extractCheckFromMutationResponse(data: unknown): Check | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeCheck(data);
  }
  return null;
}

function parseCheckPathId(checkId: string): string {
  const id = checkId.trim();
  if (!id) {
    throw new Error("Invalid check ID.");
  }
  return id;
}

export async function fetchChecks(params: CheckListParams = {}): Promise<PaginatedResult<Check>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.ACCOUNTING_CHECKS,
    page: params.page ?? DEFAULT_CHECK_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_CHECK_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasCheckListFilters(params),
    buildGetQuery: () => buildChecksQuery(params),
    buildSearchBody: () => buildCheckSearchBody(params),
    normalize: normalizePaginatedChecks,
  });
}

export async function fetchCheckById(checkId: string): Promise<Check> {
  const id = parseCheckPathId(checkId);
  const response = await apiClient.get<ApiCheck | PaginatedApiEnvelope<ApiCheck>>(
    `${API_ENDPOINTS.ACCOUNTING_CHECKS}/${id}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiCheck>).data
      : response;

  const check = normalizeCheck(raw);
  if (!check) {
    throw new Error("Check not found.");
  }

  return check;
}

export async function createCheck(values: CheckFormValues): Promise<Check> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.ACCOUNTING_CHECKS,
    buildCheckWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create check.");

  const created = extractCheckFromMutationResponse(response.data);
  if (created) return created;

  throw new Error(response.message?.trim() || response.error?.trim() || "Unable to create check.");
}

export async function updateCheck(
  checkId: string,
  values: CheckFormValues,
  options: { journalId?: string } = {},
): Promise<Check> {
  const id = parseCheckPathId(checkId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.ACCOUNTING_CHECKS}/${id}`,
    buildCheckWritePayload(values, { recordId: id, journalId: options.journalId }),
  );

  assertMutationSuccess(response, "Unable to update check.");

  const updated = extractCheckFromMutationResponse(response.data);
  if (updated) return updated;

  return fetchCheckById(id);
}

export async function deleteCheck(checkId: string): Promise<void> {
  const id = parseCheckPathId(checkId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.ACCOUNTING_CHECKS}/${id}`,
  );
  assertMutationSuccess(response, "Unable to delete check.");
}

export async function deleteChecks(checkIds: string[]): Promise<BulkSettledResult<string>> {
  const uniqueIds = [...new Set(checkIds.map((id) => id.trim()).filter(Boolean))];
  return runSettledIdsWithConcurrency(uniqueIds, deleteCheck);
}
