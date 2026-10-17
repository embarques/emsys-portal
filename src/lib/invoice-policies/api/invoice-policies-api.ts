import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  invoicePolicyFormSchema,
  invoicePolicySchema,
} from "@/lib/invoice-policies/schemas/invoice-policy.schema";
import type { InvoicePolicy, InvoicePolicyFormValues } from "@/lib/invoice-policies/types";

const endpoint = API_ENDPOINTS.INVOICE_POLICIES;

function detailPath(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid policy ID.");
  return `${endpoint}/${id}`;
}

export async function fetchInvoicePolicies(
  page = 1,
  limit = 40,
): Promise<PaginatedResult<InvoicePolicy>> {
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${endpoint}?page=${page}&limit=${limit}&sort=sortOrder:asc,title:asc`,
  );
  assertMutationSuccess(response, "Unable to load invoice policies.");
  const items = invoicePolicySchema.array().parse(response.data);
  return {
    items,
    page: response.page ?? page,
    resultsPerPage: response.resultsPerPage ?? items.length,
    total: response.total ?? items.length,
  };
}

export async function fetchAllInvoicePolicies(): Promise<InvoicePolicy[]> {
  const items: InvoicePolicy[] = [];
  for (let page = 1; ; page++) {
    const result = await fetchInvoicePolicies(page, 200);
    items.push(...result.items);
    if (!result.items.length || items.length >= result.total) return items;
  }
}

export async function fetchActiveInvoicePolicies(): Promise<InvoicePolicy[]> {
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(`${endpoint}/active`);
  assertMutationSuccess(response, "Unable to load invoice policies.");
  const list = unwrapApiData(response);
  return invoicePolicySchema
    .array()
    .parse(list)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
}

export async function fetchInvoicePolicy(id: number): Promise<InvoicePolicy> {
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(detailPath(id));
  return invoicePolicySchema.parse(unwrapApiData(response));
}

export async function createInvoicePolicy(values: InvoicePolicyFormValues): Promise<InvoicePolicy> {
  const response = await apiClient.post<ApiSuccessEnvelope<unknown>>(
    endpoint,
    invoicePolicyFormSchema.parse(values),
  );
  assertMutationSuccess(response, "Unable to create invoice policy.");
  return invoicePolicySchema.parse(unwrapApiData(response));
}

export async function updateInvoicePolicy(
  id: number,
  values: InvoicePolicyFormValues,
): Promise<InvoicePolicy> {
  const response = await apiClient.put<ApiSuccessEnvelope<unknown>>(
    detailPath(id),
    invoicePolicyFormSchema.parse(values),
  );
  assertMutationSuccess(response, "Unable to update invoice policy.");
  return invoicePolicySchema.parse(unwrapApiData(response));
}

export async function deleteInvoicePolicy(id: number): Promise<void> {
  const response = await apiClient.delete<ApiSuccessEnvelope<unknown>>(detailPath(id));
  assertMutationSuccess(response, "Unable to delete invoice policy.");
}
