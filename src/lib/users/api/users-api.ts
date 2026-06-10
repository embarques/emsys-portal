import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { buildApiListQuery, type ApiListFieldFilter } from "@/lib/api/list-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  createEmptyUserRole,
  DEFAULT_USER_LIST_PARAMS,
  normalizeUserSearchFilter,
  type User,
  type UserBranch,
  type UserFormValues,
  type UserListParams,
  type UserPermission,
  type UserRole,
} from "@/lib/users/types";

type ApiUserPermission = {
  _id?: number;
  id?: number;
  name?: string;
  resourceType?: string;
  create?: boolean;
  view?: boolean;
  update?: boolean;
  delete?: boolean;
  print?: boolean;
};

type ApiUserRole = {
  _id?: number;
  id?: number;
  name?: string;
  active?: boolean;
  permissions?: ApiUserPermission[];
  createdAt?: string;
  updatedAt?: string;
};

type ApiUserBranch = {
  _id?: number;
  id?: number;
  name?: string;
  code?: string;
};

type ApiUser = {
  _id?: number | string;
  id?: number | string;
  uid?: string;
  email?: string;
  userName?: string;
  username?: string;
  user?: string | null;
  fullName?: string;
  active?: boolean;
  accessCode?: number;
  role?: ApiUserRole;
  branch?: ApiUserBranch;
  branches?: ApiUserBranch[];
  password?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ApiUserWritePayload = {
  accessCode: number;
  active: boolean;
  branch: { id: number };
  branches: { id: number }[];
  email: string;
  fullName: string;
  role: { id: number };
  userName: string;
  user: string;
  uid?: string;
  password?: string;
  id?: number;
  type?: string;
  startTime?: string;
  endTime?: string;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function readNumericId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizePermission(raw: unknown): UserPermission | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiUserPermission;
  const id = readNumericId(item._id ?? item.id);
  if (id == null) return null;

  return {
    id,
    name: String(item.name ?? "").trim(),
    resourceType: String(item.resourceType ?? "").trim(),
    create: item.create === true,
    view: item.view === true,
    update: item.update === true,
    delete: item.delete === true,
    print: item.print === true,
  };
}

function normalizeRole(raw: unknown): UserRole {
  if (!raw || typeof raw !== "object") {
    return createEmptyUserRole();
  }

  const item = raw as ApiUserRole;
  const permissions = Array.isArray(item.permissions)
    ? item.permissions.map(normalizePermission).filter((entry): entry is UserPermission => entry != null)
    : [];

  return {
    id: readNumericId(item._id ?? item.id) ?? 0,
    name: String(item.name ?? "").trim(),
    active: item.active !== false,
    permissions,
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
  };
}

function normalizeBranch(raw: unknown): UserBranch {
  if (!raw || typeof raw !== "object") {
    return { id: 0, name: "", code: "" };
  }

  const item = raw as ApiUserBranch;

  return {
    id: readNumericId(item._id ?? item.id) ?? 0,
    name: String(item.name ?? "").trim(),
    code: String(item.code ?? "").trim(),
  };
}

function normalizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiUser;
  const id = readNumericId(item._id ?? item.id);
  if (id == null) return null;

  const userName = String(item.userName ?? item.username ?? "").trim();
  const email = String(item.email ?? "").trim();
  const fullName = String(item.fullName ?? "").trim();
  const role = normalizeRole(item.role);

  return {
    id,
    uid: String(item.uid ?? "").trim(),
    userName,
    email,
    fullName: fullName || userName || email,
    password: "",
    active: item.active !== false,
    role,
    branch: normalizeBranch(item.branch),
    startTime: String(item.startTime ?? "").trim(),
    endTime: String(item.endTime ?? "").trim(),
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
    user: item.user != null ? String(item.user).trim() || null : null,
    accessCode: Number(item.accessCode ?? 0),
    type: String(item.type ?? "").trim(),
  };
}

function normalizePaginatedUsers(payload: PaginatedApiEnvelope<unknown[]>): PaginatedResult<User> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeUser).filter((user): user is User => user != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function resolveUserListFilter(params: UserListParams): ApiListFieldFilter | undefined {
  if (params.search?.value.trim()) {
    const search = normalizeUserSearchFilter({
      ...params.search,
      value: params.search.value.trim(),
    });

    return {
      field: search.field,
      operator: search.operator,
      value: search.value,
    };
  }

  if (params.active !== undefined && params.active !== "all") {
    return { field: "active", operator: "eq", value: String(params.active) };
  }

  if (params.branch && params.branch !== "all") {
    return { field: "branch.id", operator: "eq", value: String(params.branch) };
  }

  if (params.roleId && params.roleId !== "all") {
    return { field: "role.id", operator: "eq", value: String(params.roleId) };
  }

  return undefined;
}

function buildUsersQuery(params: UserListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_USER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_USER_LIST_PARAMS.limit,
    sort: params.sort ?? DEFAULT_USER_LIST_PARAMS.sort,
    filter: resolveUserListFilter(params),
  });
}

function buildUserWritePayload(
  values: UserFormValues,
  options: { userId?: number; requirePassword?: boolean } = {},
): ApiUserWritePayload {
  const userName = values.userName.trim();
  const email = values.email.trim() || userName;
  const fullName = values.fullName.trim() || userName;
  const password = values.password.trim();
  const branchId = values.branch.id;

  if (!userName) {
    throw new Error("Username is required.");
  }

  if (options.requirePassword && !password) {
    throw new Error("Password is required.");
  }

  if (!values.role.id) {
    throw new Error("Role is required.");
  }

  if (!branchId) {
    throw new Error("Branch is required.");
  }

  const payload: ApiUserWritePayload = {
    accessCode: values.accessCode,
    active: values.active,
    branch: { id: branchId },
    branches: [{ id: branchId }],
    email,
    fullName,
    role: { id: values.role.id },
    userName,
    user: values.user?.trim() || userName,
  };

  if (options.userId != null) {
    payload.id = options.userId;
  }

  const uid = values.uid.trim();
  if (uid) {
    payload.uid = uid;
  }

  if (password) {
    payload.password = password;
  }

  const type = values.type.trim();
  if (type) {
    payload.type = type;
  }

  const startTime = values.startTime.trim();
  if (startTime) {
    payload.startTime = startTime;
  }

  const endTime = values.endTime.trim();
  if (endTime) {
    payload.endTime = endTime;
  }

  return payload;
}

function formValuesToCreateUserPayload(values: UserFormValues): ApiUserWritePayload {
  return buildUserWritePayload(values, { requirePassword: true });
}

function formValuesToUpdateUserPayload(values: UserFormValues, userId: number): ApiUserWritePayload {
  return buildUserWritePayload(values, { userId });
}

function parseUserPathId(userId: string | number): number {
  const numericId = readNumericId(userId);
  if (numericId == null) {
    throw new Error("Invalid user ID.");
  }

  return numericId;
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}

function extractUserFromMutationResponse(data: unknown): User | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeUser(data);
  }

  return null;
}

function extractCreatedUserId(response: ApiMutationEnvelope<unknown>): string | null {
  const data = response.data;

  if (typeof data === "string" || typeof data === "number") {
    const id = String(data).trim();
    return id || null;
  }

  if (data && typeof data === "object") {
    const record = data as ApiUser;
    const id = readNumericId(record._id ?? record.id);
    if (id != null) {
      return String(id);
    }
  }

  return null;
}

async function resolveCreatedUser(
  values: UserFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<User> {
  const createdId = extractCreatedUserId(response);
  if (createdId) {
    return fetchUserById(createdId);
  }

  const userName = values.userName.trim();
  if (userName) {
    const matches = await fetchUsers({
      page: 1,
      limit: 1,
      search: { field: "userName", operator: "eq", value: userName },
    });

    const matchedUser = matches.items[0];
    if (matchedUser) {
      return matchedUser;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create user.");
}

export function normalizeApiUser(raw: unknown): User | null {
  return normalizeUser(raw);
}

export async function fetchUsers(params: UserListParams = {}): Promise<PaginatedResult<User>> {
  const query = buildUsersQuery(params);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.USERS}?${query}`,
  );

  return normalizePaginatedUsers(response);
}

export async function fetchUserById(userId: string | number): Promise<User> {
  const response = await apiClient.get<ApiUser | PaginatedApiEnvelope<ApiUser>>(
    `${API_ENDPOINTS.USERS}/${userId}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiUser>).data
      : response;

  const user = normalizeUser(raw);
  if (!user) {
    throw new Error("User not found.");
  }

  return user;
}

export async function createUser(values: UserFormValues): Promise<User> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.USERS,
    formValuesToCreateUserPayload(values),
  );

  assertMutationSuccess(response, "Unable to create user.");

  return resolveCreatedUser(values, response);
}

export async function updateUser(userId: string | number, values: UserFormValues): Promise<User> {
  const numericId = parseUserPathId(userId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.USERS}/${numericId}`,
    formValuesToUpdateUserPayload(values, numericId),
  );

  assertMutationSuccess(response, "Unable to update user.");

  const updatedUser = extractUserFromMutationResponse(response.data);
  if (updatedUser) {
    return updatedUser;
  }

  return fetchUserById(numericId);
}

export async function deleteUser(userId: string | number): Promise<void> {
  const numericId = parseUserPathId(userId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.USERS}/${numericId}`,
  );

  assertMutationSuccess(response, "Unable to delete user.");
}

export async function deleteUsers(userIds: Array<string | number>): Promise<void> {
  await Promise.all(userIds.map((userId) => deleteUser(userId)));
}
