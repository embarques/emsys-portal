import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery, type ApiListSortInput } from "@/lib/api/list-query";
import {
  buildStripeStyleSearchBody,
  createOrTextSearchFilterGroup,
  hasListTextSearch,
  type ApiListTextSearch,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";

export type EmployeeGroupMemberOption = { id: number; name: string };

/** Shape derived from employee_group.EmployeeGroup (`id` is a string). */
export type EmployeeGroupOption = {
  id: string;
  employeeGroupId: string;
  name: string;
  branch?: string;
  employees: EmployeeGroupMemberOption[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

type ApiUser = {
  id?: number;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiEmployeeGroup = {
  id?: string | number;
  employeeGroupId?: string;
  name?: string;
  branch?: string;
  employees?: { id?: number; name?: string }[];
  createdAt?: string;
  createdBy?: ApiUser | string;
  updatedAt?: string;
  updatedBy?: ApiUser | string;
};

function readUserName(user: unknown): string {
  if (!user) return "";
  if (typeof user === "string") return user.trim();
  if (typeof user === "object") {
    const entry = user as ApiUser;
    return String(entry.fullName ?? entry.userName ?? entry.name ?? "").trim();
  }
  return "";
}

export type EmployeeGroupListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: ApiListTextSearch;
};

export type EmployeeGroupSearchFilter = ApiListTextSearch;

export type CreateEmployeeGroupInput = {
  name: string;
  branch: string;
  employees: { id: number; name: string }[];
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
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
  const employeeGroupId = String(item.employeeGroupId ?? "").trim();

  return {
    id,
    employeeGroupId: employeeGroupId || id,
    name: name || id,
    branch: branch || undefined,
    employees: Array.isArray(item.employees)
      ? item.employees.flatMap((employee) => {
          const employeeId = Number(employee.id);
          const employeeName = String(employee.name ?? "").trim();
          return Number.isFinite(employeeId) && employeeName
            ? [{ id: employeeId, name: employeeName }]
            : [];
        })
      : [],
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readUserName(item.createdBy) || DEFAULT_CREATED_BY,
    updatedAt: String(item.updatedAt ?? "").trim(),
    updatedBy: readUserName(item.updatedBy),
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
  const isFiltered = hasListTextSearch(params.search);
  const searchGroup = params.search?.value
    ? createOrTextSearchFilterGroup(
        params.search.value,
        ["name", "employees.name", "branch"],
        params.search.operator ?? "contains",
      )
    : null;

  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.EMPLOYEE_GROUPS,
    page,
    limit,
    offset: params.offset,
    isFiltered,
    buildGetQuery: () =>
      buildApiListQuery({
        page,
        limit,
        offset: params.offset,
        sort: params.sort ?? DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS.sort,
      }),
    buildSearchBody: () =>
      buildStripeStyleSearchBody({
        sort: params.sort ?? DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS.sort,
        filterGroups: searchGroup ? [searchGroup] : [],
      }),
    normalize: normalizePaginatedEmployeeGroups,
  });
}

export async function createEmployeeGroup(
  input: CreateEmployeeGroupInput,
): Promise<EmployeeGroupOption> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.EMPLOYEE_GROUPS,
    {
      name: input.name.trim(),
      branch: input.branch,
      employees: input.employees,
    },
  );

  if (response.success === false) {
    throw new Error(
      response.message?.trim() || response.error?.trim() || "Unable to create employee group.",
    );
  }

  const group = normalizeEmployeeGroup(response.data);
  if (!group) {
    throw new Error("The employee group was created but the API did not return its details.");
  }

  return group;
}

export async function deleteEmployeeGroup(employeeGroupId: string): Promise<void> {
  const id = employeeGroupId.trim();
  if (!id) {
    throw new Error("A valid employee group id is required to delete.");
  }

  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.EMPLOYEE_GROUPS}/${id}`,
  );

  if (response.success === false) {
    throw new Error(
      response.message?.trim() || response.error?.trim() || "Unable to delete employee group.",
    );
  }
}

export async function deleteEmployeeGroups(employeeGroupIds: string[]): Promise<void> {
  await Promise.all(employeeGroupIds.map((id) => deleteEmployeeGroup(id)));
}
