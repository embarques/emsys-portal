import { workflowWriteHeaders, type WorkflowWriteMethod } from '../utils/request-headers';
import { apiClient } from '@/lib/api/client';
import { INVENTORY_WORKFLOW_ENDPOINTS } from '@/lib/api/endpoints';
import { buildApiListQuery } from '@/lib/api/list-query';
import { buildApiSearchPaginationQuery, buildStripeStyleSearchBody, type ApiSearchFilter } from '@/lib/api/search-query';
import type { Envelope, Page, WorkflowRecord } from '../types/workflow';

export const WORKFLOW_PAGE_SIZE = 50;

export function workflowEndpoint(resource: string) {
  const endpoint = INVENTORY_WORKFLOW_ENDPOINTS[resource as keyof typeof INVENTORY_WORKFLOW_ENDPOINTS];
  if (!endpoint) throw new Error('Unknown inventory resource.');
  return endpoint;
}

/** Null or missing `data` is an empty page; any other non-array is a contract error. */
function readPage(payload: unknown, page: number): Page {
  const envelope = (payload ?? {}) as Partial<Page> & { data?: unknown };
  const data = envelope.data ?? [];
  if (!Array.isArray(data)) throw new Error('inventory.operations.errors.listContract');
  return {
    data: data as WorkflowRecord[],
    page: typeof envelope.page === 'number' ? envelope.page : page,
    resultsPerPage: typeof envelope.resultsPerPage === 'number' ? envelope.resultsPerPage : undefined,
    total: typeof envelope.total === 'number' ? envelope.total : undefined,
  };
}

/**
 * Unfiltered lists use `GET ?page&limit`; filtered lists use the standard query
 * DSL via `POST {resource}/search` (Swagger declares no list query parameters).
 */
export async function listWorkflow(resource: string, filters: Record<string, string>, page = 1): Promise<Page> {
  const endpoint = workflowEndpoint(resource);
  const active: ApiSearchFilter[] = Object.entries(filters)
    .filter(([, value]) => value !== '')
    .map(([field, value]) => ({ field, operator: 'eq', value }));
  if (active.length === 0) {
    return readPage(await apiClient.get(`${endpoint}?${buildApiListQuery({ page, limit: WORKFLOW_PAGE_SIZE })}`), page);
  }
  const pagination = buildApiSearchPaginationQuery({ page, limit: WORKFLOW_PAGE_SIZE, offset: (page - 1) * WORKFLOW_PAGE_SIZE });
  const body = buildStripeStyleSearchBody({ filterGroups: [{ operator: 'and', filters: active }] });
  return readPage(await apiClient.post(`${endpoint}/search?${pagination}`, body), page);
}

/** Next page number, or `undefined` when every record is loaded. */
export function nextWorkflowPage(last: Page, pages: Page[]): number | undefined {
  const loaded = pages.reduce((sum, page) => sum + page.data.length, 0);
  if (typeof last.total === 'number') return loaded < last.total ? last.page + 1 : undefined;
  return last.data.length >= WORKFLOW_PAGE_SIZE ? last.page + 1 : undefined;
}

export async function readWorkflow(resource: string, id: string, child?: string): Promise<Envelope> {
  return apiClient.get<Envelope>(`${workflowEndpoint(resource)}/${encodeURIComponent(id)}${child ? `/${child}` : ''}`);
}

export type Write = {
  resource: string;
  id?: string;
  /** Sub-path after `/{id}/`, e.g. `post`, `status`, `allocations/{allocationId}`. */
  path?: string;
  method?: WorkflowWriteMethod;
  data?: Record<string, unknown>;
  versioned?: boolean;
  version?: number;
  idempotencyKey: string;
};

export async function writeWorkflow(input: Write): Promise<Envelope> {
  const method = input.method ?? 'post';
  const url = `${workflowEndpoint(input.resource)}${input.id ? `/${encodeURIComponent(input.id)}` : ''}${input.path ? `/${input.path}` : ''}`;
  const headers = workflowWriteHeaders({ method, versioned: Boolean(input.versioned), version: input.version, idempotencyKey: input.idempotencyKey });
  const config = { headers };
  const response =
    method === 'patch' ? await apiClient.patch<Envelope>(url, input.data, config)
      : method === 'put' ? await apiClient.put<Envelope>(url, input.data, config)
        : method === 'delete' ? await apiClient.delete<Envelope>(url, undefined, config)
          : await apiClient.post<Envelope>(url, input.data, config);
  if ((response as { success?: boolean })?.success === false) {
    const failure = response as { message?: string; error?: string };
    throw new Error(failure.message || failure.error || 'inventory.operations.errors.requestFailed');
  }
  return response;
}

export function workflowError(error: unknown): string {
  const payload = (error as { response?: { data?: { message?: string; error?: string | { message?: string; code?: string; correlationId?: string } } } })?.response?.data;
  if (typeof payload?.error === 'string') return [payload.message, payload.error].filter(Boolean).join(' — ');
  const response = payload?.error;
  if (response?.message) return `${response.message}${response.code ? ` (${response.code})` : ''}${response.correlationId ? ` — ${response.correlationId}` : ''}`;
  if (payload?.message) return payload.message;
  return error instanceof Error ? error.message : 'inventory.operations.errors.requestFailed';
}

export function normalizeRecord(response: Envelope): WorkflowRecord {
  return { ...response.data, version: response.version ?? response.data.version };
}
