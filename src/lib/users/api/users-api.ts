import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  hasResourceListFilters,
  type ApiSearchFilter,
} from "@/lib/api/search-query";
import { USER_TABLE_FILTER_FIELDS } from "@/lib/users/filter-fields";
import { expandUserFilterNode } from "@/lib/users/user-filters";
import { USER_BAR_OR_SEARCH_FIELDS } from "@/lib/users/search-fields";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  DEFAULT_USER_LIST_PARAMS,
  type User,
  type UserFormValues,
  type UserListParams,
  type UserReference,
  type UserWritePayload,
} from "@/lib/users/types";

type ApiUser = {
  _id?: number | string;
  id?: number | string;
  uid?: string;
  email?: string;
  name?: string;
  active?: boolean;
  branch?: ApiReference;
  role?: ApiReference;
  startTime?: string;
  endTime?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: ApiReference;
  updatedBy?: ApiReference;
};

type ApiReference = { _id?: number; id?: number; name?: string };
type ApiEnvelope<T> = PaginatedApiEnvelope<T> & { success?: boolean; message?: string; error?: string };

function readId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeReference(raw: ApiReference | undefined): UserReference {
  return {
    id: readId(raw?._id ?? raw?.id) ?? 0,
    name: String(raw?.name ?? "").trim(),
  };
}

function normalizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as ApiUser;
  const id = readId(item._id ?? item.id);
  if (id == null) return null;
  return {
    id,
    uid: String(item.uid ?? "").trim(),
    email: String(item.email ?? "").trim(),
    name: String(item.name ?? item.email ?? "").trim(),
    active: item.active !== false,
    branch: normalizeReference(item.branch),
    role: normalizeReference(item.role),
    startTime: String(item.startTime ?? "").trim(),
    endTime: String(item.endTime ?? "").trim(),
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
    createdBy: item.createdBy ? normalizeReference(item.createdBy) : null,
    updatedBy: item.updatedBy ? normalizeReference(item.updatedBy) : null,
  };
}

function normalizeUsers(payload: PaginatedApiEnvelope<unknown[]>): PaginatedResult<User> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeUser).filter((item): item is User => item != null)
    : [];
  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function chipFilters(params: UserListParams): ApiSearchFilter[] {
  const filters: ApiSearchFilter[] = [];
  if (params.active !== undefined && params.active !== "all") {
    filters.push({ field: "active", operator: "eq", value: params.active });
  }
  if (params.branch && params.branch !== "all") {
    filters.push({ field: "branch.id", operator: "eq", value: Number(params.branch) });
  }
  if (params.roleId && params.roleId !== "all") {
    filters.push({ field: "role.id", operator: "eq", value: Number(params.roleId) });
  }
  return filters;
}

function hasFilters(params: UserListParams): boolean {
  return hasResourceListFilters({
    search: params.search,
    filterRows: params.filterRows,
    tableFilterFields: USER_TABLE_FILTER_FIELDS,
    hasChipFilters: chipFilters(params).length > 0,
  });
}

function listQuery(params: UserListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_USER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_USER_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_USER_LIST_PARAMS.sort,
  });
}

function searchBody(params: UserListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_USER_LIST_PARAMS.sort,
    filterGroups: buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: USER_BAR_OR_SEARCH_FIELDS,
      filterRows: params.filterRows,
      tableFilterFields: USER_TABLE_FILTER_FIELDS,
      chipFilters: chipFilters(params),
      expandNode: expandUserFilterNode,
    }),
  });
}

function writePayload(values: UserFormValues, uid?: string): UserWritePayload {
  const payload: UserWritePayload = {
    email: values.email.trim(),
    name: values.name.trim(),
    active: values.active,
    branch: { id: values.branch.id, name: values.branch.name },
    role: { id: values.role.id, name: values.role.name },
  };
  if (uid) payload.uid = uid;
  if (values.restrictLoginHours) {
    payload.startTime = values.startTime;
    payload.endTime = values.endTime;
  } else {
    payload.startTime = "";
    payload.endTime = "";
  }
  return payload;
}

function assertSuccess(response: ApiEnvelope<unknown>, fallback: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallback);
  }
}

export function normalizeApiUser(raw: unknown): User | null {
  return normalizeUser(raw);
}

export async function fetchUsers(params: UserListParams = {}): Promise<PaginatedResult<User>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.USERS,
    page: params.page ?? DEFAULT_USER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_USER_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasFilters(params),
    buildGetQuery: () => listQuery(params),
    buildSearchBody: () => searchBody(params),
    normalize: normalizeUsers,
  });
}

export async function fetchUserById(userId: string | number): Promise<User> {
  const response = await apiClient.get<ApiEnvelope<ApiUser>>(`${API_ENDPOINTS.USERS}/${userId}`);
  const user = normalizeUser(response.data ?? response);
  if (!user) throw new Error("User not found.");
  return user;
}

export async function fetchCurrentUser(): Promise<User> {
  const response = await apiClient.get<ApiEnvelope<ApiUser>>(API_ENDPOINTS.CURRENT_USER);
  const user = normalizeUser(response.data);
  if (!user) throw new Error("Current tenant user not found.");
  return user;
}

export async function createUser(values: UserFormValues, uid: string): Promise<User> {
  const response = await apiClient.post<ApiEnvelope<ApiUser>>(API_ENDPOINTS.USERS, writePayload(values, uid));
  assertSuccess(response, "Unable to create user.");
  const user = normalizeUser(response.data);
  if (user) return user;
  const matches = await fetchUsers({
    page: 1,
    limit: 1,
    search: { field: "email", operator: "eq", value: values.email.trim() },
  });
  if (!matches.items[0]) throw new Error("User was created but could not be reloaded.");
  return matches.items[0];
}

export async function updateUser(userId: string | number, values: UserFormValues): Promise<User> {
  const response = await apiClient.put<ApiEnvelope<ApiUser>>(
    `${API_ENDPOINTS.USERS}/${userId}`,
    writePayload(values),
  );
  assertSuccess(response, "Unable to update user.");
  return normalizeUser(response.data) ?? fetchUserById(userId);
}

export async function deactivateUser(user: User): Promise<User> {
  return updateUser(user.id, { ...userToValues(user), active: false });
}

function userToValues(user: User): UserFormValues {
  return {
    email: user.email,
    name: user.name,
    password: "",
    active: user.active,
    branch: user.branch,
    role: user.role,
    restrictLoginHours: Boolean(user.startTime || user.endTime),
    startTime: user.startTime,
    endTime: user.endTime,
  };
}
