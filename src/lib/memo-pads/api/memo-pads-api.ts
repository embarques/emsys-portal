import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildAdvancedSearchBody,
  buildApiFilterNodeFromTableRows,
  createOrTextSearchFilterGroup,
  createTextSearchFilter,
  hasListTextSearch,
  isApiSearchFilter,
  resolveSearchField,
  resolveSearchOperator,
  type ApiSearchFilterGroup,
} from "@/lib/api/search-query";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import { MEMO_PAD_TABLE_FILTER_FIELDS } from "@/lib/memo-pads/filter-fields";
import { MEMO_PAD_BAR_OR_SEARCH_FIELDS } from "@/lib/memo-pads/search-fields";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import {
  DEFAULT_MEMO_PAD_LIST_PARAMS,
  type MemoPad,
  type MemoPadFormValues,
  type MemoPadListParams,
  type MemoPadUserRef,
} from "@/lib/memo-pads/types";

type ApiMemoPadUser = {
  id?: number | string;
  name?: string;
};

type ApiMemoPad = {
  id?: string;
  name?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: ApiMemoPadUser | null;
  updatedBy?: ApiMemoPadUser | null;
};

/** POST/PUT /memo-pads payload. */
type ApiMemoPadWritePayload = {
  name: string;
  content: string;
  id?: string;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function readNumericId(value: number | string | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeUserRef(raw?: ApiMemoPadUser | null): MemoPadUserRef | null {
  if (!raw || typeof raw !== "object") return null;

  const name = String(raw.name ?? "").trim();
  const id = readNumericId(raw.id);
  if (id == null && !name) return null;

  return { id, name };
}

export function normalizeApiMemoPad(raw: unknown): MemoPad | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiMemoPad;
  const id = String(item.id ?? "").trim();
  if (!id) return null;

  return {
    id,
    name: String(item.name ?? "").trim(),
    content: String(item.content ?? ""),
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
    createdBy: normalizeUserRef(item.createdBy),
    updatedBy: normalizeUserRef(item.updatedBy),
  };
}

function normalizePaginatedMemoPads(
  payload: PaginatedApiEnvelope<unknown[]>,
  options: { isFiltered?: boolean } = {},
): PaginatedResult<MemoPad> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeApiMemoPad).filter((memoPad): memoPad is MemoPad => memoPad != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, options),
  };
}

function hasMemoPadListFilters(params: MemoPadListParams): boolean {
  return (
    hasListTextSearch(params.search) ||
    (params.filterRows ?? []).some((row) => isCompleteFilterRow(row))
  );
}

function buildMemoPadSearchFilterGroups(params: MemoPadListParams): ApiSearchFilterGroup[] {
  const groups: ApiSearchFilterGroup[] = [];

  if (params.search?.value.trim()) {
    if (params.search.field) {
      const explicitFilter = createTextSearchFilter(
        resolveSearchField(params.search, "name"),
        params.search.value,
        resolveSearchOperator(params.search),
      );
      if (explicitFilter) {
        groups.push({ operator: "and", filters: [explicitFilter] });
      }
    } else {
      const orGroup = createOrTextSearchFilterGroup(
        params.search.value,
        [...MEMO_PAD_BAR_OR_SEARCH_FIELDS],
        "contains",
      );
      if (orGroup) {
        groups.push(orGroup);
      }
    }
  }

  const rowFilterNode = buildApiFilterNodeFromTableRows(
    params.filterRows ?? [],
    MEMO_PAD_TABLE_FILTER_FIELDS,
  );

  if (rowFilterNode) {
    if (isApiSearchFilter(rowFilterNode)) {
      groups.push({ operator: "and", filters: [rowFilterNode] });
    } else {
      groups.push(rowFilterNode);
    }
  }

  return groups;
}

/** POST /memo-pads/search — unified advanced-search body. */
function buildMemoPadSearchBody(params: MemoPadListParams) {
  return buildAdvancedSearchBody({
    page: params.page ?? DEFAULT_MEMO_PAD_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_MEMO_PAD_LIST_PARAMS.limit,
    sort: params.sort ?? DEFAULT_MEMO_PAD_LIST_PARAMS.sort,
    filterGroups: buildMemoPadSearchFilterGroups(params),
  });
}

/** GET /memo-pads — unfiltered paginated list. */
function buildMemoPadsQuery(params: MemoPadListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_MEMO_PAD_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_MEMO_PAD_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_MEMO_PAD_LIST_PARAMS.sort,
  });
}

export async function fetchMemoPads(
  params: MemoPadListParams = {},
): Promise<PaginatedResult<MemoPad>> {
  if (hasMemoPadListFilters(params)) {
    const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
      `${API_ENDPOINTS.MEMO_PADS}/search`,
      buildMemoPadSearchBody(params),
    );

    return normalizePaginatedMemoPads(response, { isFiltered: true });
  }

  const query = buildMemoPadsQuery(params);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.MEMO_PADS}?${query}`,
  );

  return normalizePaginatedMemoPads(response);
}

function buildMemoPadWritePayload(
  values: MemoPadFormValues,
  options: { memoPadId?: string } = {},
): ApiMemoPadWritePayload {
  const name = values.name.trim();
  if (!name) {
    throw new Error("Memo name is required.");
  }

  const payload: ApiMemoPadWritePayload = {
    name,
    content: values.content ?? "",
  };

  if (options.memoPadId) {
    payload.id = options.memoPadId;
  }

  return payload;
}


function extractMemoPadFromMutationResponse(data: unknown): MemoPad | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeApiMemoPad(data);
  }

  return null;
}

function extractCreatedMemoPadId(response: ApiMutationEnvelope<unknown>): string | null {
  const data = response.data;

  if (typeof data === "string") {
    const id = data.trim();
    return id || null;
  }

  const memoPad = extractMemoPadFromMutationResponse(data);
  return memoPad?.id ?? null;
}

async function resolveCreatedMemoPad(
  response: ApiMutationEnvelope<unknown>,
): Promise<MemoPad> {
  const createdId = extractCreatedMemoPadId(response);
  if (createdId) {
    return fetchMemoPadById(createdId);
  }

  const memoPad = extractMemoPadFromMutationResponse(response.data);
  if (memoPad) {
    return memoPad;
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create memo pad.");
}

export async function createMemoPad(values: MemoPadFormValues): Promise<MemoPad> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.MEMO_PADS,
    buildMemoPadWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create memo pad.");

  return resolveCreatedMemoPad(response);
}

export async function updateMemoPad(
  memoPadId: string,
  values: MemoPadFormValues,
): Promise<MemoPad> {
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.MEMO_PADS}/${memoPadId}`,
    buildMemoPadWritePayload(values, { memoPadId }),
  );

  assertMutationSuccess(response, "Unable to update memo pad.");

  const updatedMemoPad = extractMemoPadFromMutationResponse(response.data);
  if (updatedMemoPad) {
    return updatedMemoPad;
  }

  return fetchMemoPadById(memoPadId);
}

export async function deleteMemoPad(memoPadId: string): Promise<void> {
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.MEMO_PADS}/${memoPadId}`,
  );

  assertMutationSuccess(response, "Unable to delete memo pad.");
}

export async function deleteMemoPads(memoPadIds: string[]): Promise<void> {
  await Promise.all(memoPadIds.map((memoPadId) => deleteMemoPad(memoPadId)));
}

export async function fetchMemoPadById(memoPadId: string): Promise<MemoPad> {
  const response = await apiClient.get<ApiMemoPad | PaginatedApiEnvelope<ApiMemoPad>>(
    `${API_ENDPOINTS.MEMO_PADS}/${memoPadId}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiMemoPad>).data
      : response;

  const memoPad = normalizeApiMemoPad(raw);
  if (!memoPad) {
    throw new Error("Memo pad not found.");
  }

  return memoPad;
}
