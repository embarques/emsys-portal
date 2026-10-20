import { CLEARABLE_PAYMENT_API_TABLE_FIELDS } from "@/lib/accounting/clearable-payments/table-fields";
import { captureApiTableFields, readApiUserUsername } from "@/lib/table/api-table-fields";
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
import { CLEARABLE_PAYMENT_BAR_OR_SEARCH_FIELDS } from "@/lib/accounting/clearable-payments/search-fields";
import {
  CLEARABLE_PAYMENT_TABLE_FILTER_FIELDS,
  expandClearablePaymentFilterNode,
} from "@/lib/accounting/clearable-payments/filter-fields";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import {
  DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS,
  parseClearablePaymentAmount,
  type ClearablePayment,
  type ClearablePaymentFormValues,
  type ClearablePaymentInvoiceRef,
  type ClearablePaymentListParams,
  type ClearablePaymentStatus,
} from "@/lib/accounting/clearable-payments/types";

type ApiUser = {
  id?: number;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiClearablePaymentInvoice = {
  id?: string;
  number?: string;
  cost?: number;
  discount?: number;
  payment?: number;
  balance?: number;
};

type ApiClearablePaymentJournal = {
  id?: string;
};

type ApiClearablePayment = {
  id?: string;
  paymentReference?: string;
  refNumber?: string;
  paymentAmount?: number;
  datePosted?: string;
  clearedAt?: string;
  status?: string;
  invoice?: ApiClearablePaymentInvoice | null;
  journal?: ApiClearablePaymentJournal | null;
  createdAt?: string;
  createdBy?: ApiUser | string;
  updatedAt?: string;
  updatedBy?: ApiUser | string;
};

type ApiClearablePaymentWritePayload = {
  id?: string;
  paymentReference: string;
  paymentAmount: number;
  invoice: { id: string; number?: string };
  refNumber?: string;
  datePosted?: string;
  status?: ClearablePaymentStatus;
  clearedAt?: string;
  journal?: { id: string };
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function hasClearablePaymentListFilters(params: ClearablePaymentListParams): boolean {
  return hasResourceListFilters({
    search: params.search,
    filterRows: params.filterRows,
    tableFilterFields: CLEARABLE_PAYMENT_TABLE_FILTER_FIELDS,
  });
}

function buildClearablePaymentSearchBody(params: ClearablePaymentListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS.sort,
    filterGroups: buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: CLEARABLE_PAYMENT_BAR_OR_SEARCH_FIELDS,
      filterRows: params.filterRows,
      tableFilterFields: CLEARABLE_PAYMENT_TABLE_FILTER_FIELDS,
      expandNode: expandClearablePaymentFilterNode,
    }),
  });
}

function buildClearablePaymentsQuery(params: ClearablePaymentListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS.sort,
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
function toClearablePaymentApiDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00Z`;
}

function normalizeClearablePaymentStatus(value: unknown): ClearablePaymentStatus {
  return String(value ?? "").trim().toUpperCase() === "CLEARED" ? "CLEARED" : "OUTSTANDING";
}

function normalizeInvoice(raw: ApiClearablePaymentInvoice | null | undefined): ClearablePaymentInvoiceRef {
  return {
    id: readStringId(raw?.id) ?? "",
    number: String(raw?.number ?? "").trim(),
    cost: raw?.cost == null ? undefined : numberValue(raw.cost),
    discount: raw?.discount == null ? undefined : numberValue(raw.discount),
    payment: raw?.payment == null ? undefined : numberValue(raw.payment),
    balance: raw?.balance == null ? undefined : numberValue(raw.balance),
  };
}

export function normalizeClearablePayment(raw: unknown): ClearablePayment | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiClearablePayment;
  const id = readStringId(item.id);
  if (!id) return null;

  const invoice = normalizeInvoice(item.invoice);
  const journalId = readStringId(item.journal?.id);

  return {
    ...captureApiTableFields(raw, CLEARABLE_PAYMENT_API_TABLE_FIELDS),
    id,
    status: normalizeClearablePaymentStatus(item.status),
    paymentReference: String(item.paymentReference ?? "").trim(),
    refNumber: String(item.refNumber ?? "").trim(),
    paymentAmount: numberValue(item.paymentAmount),
    datePosted: String(item.datePosted ?? "").trim(),
    clearedAt: String(item.clearedAt ?? "").trim(),
    invoice,
    journalId,
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readUserName(item.createdBy),
    updatedAt: String(item.updatedAt ?? "").trim() || undefined,
    updatedBy: readApiUserUsername(item.updatedBy) || undefined,
  };
}

function normalizePaginatedClearablePayments(
  payload: PaginatedApiEnvelope<unknown[]>,
  context: { isFiltered?: boolean } = {},
): PaginatedResult<ClearablePayment> {
  const items = Array.isArray(payload.data)
    ? payload.data
        .map(normalizeClearablePayment)
        .filter((payment): payment is ClearablePayment => payment != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, context),
  };
}

export function buildClearablePaymentWritePayload(
  values: ClearablePaymentFormValues,
  options: { recordId?: string; journalId?: string } = {},
): ApiClearablePaymentWritePayload {
  const invoiceId = values.invoiceId.trim();
  const paymentReference = values.paymentReference.trim();
  const paymentAmount = parseClearablePaymentAmount(values.paymentAmount);
  if (!invoiceId) {
    throw new Error("Invoice is required.");
  }
  if (!paymentReference) {
    throw new Error("Payment reference is required.");
  }
  if (paymentAmount == null) {
    throw new Error("Payment amount is required.");
  }

  const payload: ApiClearablePaymentWritePayload = {
    invoice: {
      id: invoiceId,
      ...(values.invoiceNumber.trim() ? { number: values.invoiceNumber.trim() } : {}),
    },
    paymentReference,
    paymentAmount,
    status: values.status,
  };

  const refNumber = values.refNumber.trim();
  if (refNumber) payload.refNumber = refNumber;

  const datePosted = toClearablePaymentApiDate(values.datePosted);
  if (datePosted) payload.datePosted = datePosted;

  if (values.status === "CLEARED") {
    const clearedAt = toClearablePaymentApiDate(values.clearedAt) ?? datePosted;
    if (clearedAt) payload.clearedAt = clearedAt;
  }

  if (options.recordId) payload.id = options.recordId;
  if (options.journalId) payload.journal = { id: options.journalId };

  return payload;
}

function extractClearablePaymentFromMutationResponse(data: unknown): ClearablePayment | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeClearablePayment(data);
  }
  return null;
}

function parseClearablePaymentPathId(paymentId: string): string {
  const id = paymentId.trim();
  if (!id) {
    throw new Error("Invalid payment ID.");
  }
  return id;
}

export async function fetchClearablePayments(
  endpoint: string,
  params: ClearablePaymentListParams = {},
): Promise<PaginatedResult<ClearablePayment>> {
  return fetchPaginatedResourceList({
    endpoint,
    page: params.page ?? DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasClearablePaymentListFilters(params),
    buildGetQuery: () => buildClearablePaymentsQuery(params),
    buildSearchBody: () => buildClearablePaymentSearchBody(params),
    normalize: normalizePaginatedClearablePayments,
  });
}

export async function fetchClearablePaymentById(
  endpoint: string,
  paymentId: string,
): Promise<ClearablePayment> {
  const id = parseClearablePaymentPathId(paymentId);
  const response = await apiClient.get<ApiClearablePayment | PaginatedApiEnvelope<ApiClearablePayment>>(
    `${endpoint}/${id}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiClearablePayment>).data
      : response;

  const payment = normalizeClearablePayment(raw);
  if (!payment) {
    throw new Error("Payment not found.");
  }

  return payment;
}

export async function createClearablePayment(
  endpoint: string,
  values: ClearablePaymentFormValues,
): Promise<ClearablePayment> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    endpoint,
    buildClearablePaymentWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create payment.");

  const created = extractClearablePaymentFromMutationResponse(response.data);
  if (created) return created;

  throw new Error(response.message?.trim() || response.error?.trim() || "Unable to create payment.");
}

export async function updateClearablePayment(
  endpoint: string,
  paymentId: string,
  values: ClearablePaymentFormValues,
  options: { journalId?: string } = {},
): Promise<ClearablePayment> {
  const id = parseClearablePaymentPathId(paymentId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${endpoint}/${id}`,
    buildClearablePaymentWritePayload(values, { recordId: id, journalId: options.journalId }),
  );

  assertMutationSuccess(response, "Unable to update payment.");

  const updated = extractClearablePaymentFromMutationResponse(response.data);
  if (updated) return updated;

  return fetchClearablePaymentById(endpoint, id);
}

export async function deleteClearablePayment(endpoint: string, paymentId: string): Promise<void> {
  const id = parseClearablePaymentPathId(paymentId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(`${endpoint}/${id}`);
  assertMutationSuccess(response, "Unable to delete payment.");
}

export async function deleteClearablePayments(
  endpoint: string,
  paymentIds: string[],
): Promise<BulkSettledResult<string>> {
  const uniqueIds = [...new Set(paymentIds.map((id) => id.trim()).filter(Boolean))];
  return runSettledIdsWithConcurrency(uniqueIds, (id) => deleteClearablePayment(endpoint, id));
}
