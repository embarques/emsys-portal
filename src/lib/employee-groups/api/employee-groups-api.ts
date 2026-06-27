import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery, type ApiListSortInput } from "@/lib/api/list-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";

/** Picker-friendly shape derived from employee_group.EmployeeGroup (`id` is a string). */
export type EmployeeGroupOption = {
  id: string;
  name: string;
  branch?: string;
};

type ApiEmployeeGroup = {
  id?: string | number;
  name?: string;
  branch?: string;
};

export type EmployeeGroupListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
};

export const DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS = {
  page: 1,
  limit: 200,
  sort: "name:asc",
} as const satisfies EmployeeGroupListParams;

function normalizeEmployeeGroup(raw: unknown): EmployeeGroupOption | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiEmployeeGroup;
  const id = String(item.id ?? "").trim();
  if (!id) return null;

  const name = String(item.name ?? "").trim();
  const branch = String(item.branch ?? "").trim();

  return {
    id,
    name: name || id,
    branch: branch || undefined,
  };
}

function normalizePaginatedEmployeeGroups(
  payload: PaginatedApiEnvelope<unknown[]>,
  context: { isFiltered?: boolean } = {},
): PaginatedResult<EmployeeGroupOption> {
  const items = Array.isArray(payload.data)
    ? payload.data
        .map(normalizeEmployeeGroup)
        .filter((group): group is EmployeeGroupOption => group != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, context),
  };
}

export async function fetchEmployeeGroups(
  params: EmployeeGroupListParams = {},
): Promise<PaginatedResult<EmployeeGroupOption>> {
  const page = params.page ?? DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS.limit;

  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.EMPLOYEE_GROUPS,
    page,
    limit,
    offset: params.offset,
    isFiltered: false,
    buildGetQuery: () =>
      buildApiListQuery({
        page,
        limit,
        offset: params.offset,
        sort: params.sort ?? DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS.sort,
      }),
    buildSearchBody: () => ({}),
    normalize: normalizePaginatedEmployeeGroups,
  });
}
