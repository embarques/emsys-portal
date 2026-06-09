import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import type {
  User,
  UserBranch,
  UserFormValues,
  UserListParams,
  UserStatus,
} from "@/lib/users/types";

type ApiUserRole = {
  _id?: number;
  id?: number;
  name?: string;
};

type ApiUserBranch = {
  _id?: number;
  id?: number;
  code?: string;
};

type ApiUser = {
  _id?: number | string;
  id?: number | string;
  uid?: string;
  email?: string;
  userName?: string;
  username?: string;
  user?: string;
  fullName?: string;
  active?: boolean;
  accessCode?: number;
  role?: ApiUserRole;
  branch?: ApiUserBranch;
  branches?: ApiUserBranch[];
  phone?: string;
  language?: string;
  password?: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  createdAt?: string;
  createdBy?: string;
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
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

const BRANCH_ID_TO_PORTAL: Record<number, UserBranch> = {
  1: "usa",
  2: "dr",
};

const PORTAL_BRANCH_TO_ID: Record<UserBranch, number> = {
  usa: 1,
  dr: 2,
};

const BRANCH_CODE_TO_PORTAL: Record<string, UserBranch> = {
  NY: "usa",
  DR: "dr",
  DO: "dr",
};

function readNumericId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function branchToPortal(branch: ApiUserBranch | undefined): UserBranch {
  const branchId = readNumericId(branch?._id ?? branch?.id);
  if (branchId != null && BRANCH_ID_TO_PORTAL[branchId]) {
    return BRANCH_ID_TO_PORTAL[branchId];
  }

  const code = branch?.code?.trim().toUpperCase();
  if (code && BRANCH_CODE_TO_PORTAL[code]) {
    return BRANCH_CODE_TO_PORTAL[code];
  }

  return "usa";
}

function portalBranchToId(branch: UserBranch): number {
  return PORTAL_BRANCH_TO_ID[branch];
}

function activeToStatus(active: boolean | undefined): UserStatus {
  return active === false ? "inactive" : "active";
}

function statusToActive(status: UserStatus): boolean {
  return status === "active";
}

function normalizeLanguage(value: string | undefined): User["language"] {
  return value === "es" ? "es" : "en";
}

function normalizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiUser;
  const userId = readNumericId(item._id ?? item.id);
  if (userId == null) return null;

  const username = String(item.userName ?? item.username ?? "").trim();
  const email = String(item.email ?? "").trim();
  const roleId = readNumericId(item.role?._id ?? item.role?.id) ?? 0;
  const roleName = String(item.role?.name ?? "").trim();

  const fullName = String(item.fullName ?? "").trim();

  return {
    userId: String(userId),
    uid: String(item.uid ?? "").trim(),
    username,
    password: "",
    name: fullName || username || email,
    status: activeToStatus(item.active),
    roleId,
    roleName,
    language: normalizeLanguage(item.language),
    branch: branchToPortal(item.branch),
    branchCode: String(item.branch?.code ?? "").trim(),
    email,
    phone: String(item.phone ?? "").trim(),
    createdAt: item.createdAt ?? "",
    createdBy: String(item.createdBy ?? "").trim(),
    updatedAt: item.updatedAt ?? "",
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

function buildUsersQuery(params: UserListParams): string {
  const page = params.page ?? 1;
  const limit = params.limit ?? 40;
  const searchParams = new URLSearchParams({
    page: String(page),
    start: String((page - 1) * limit),
    limit: String(limit),
    sortField: params.sortField ?? "userName",
    sortDirection: params.sortDirection ?? "asc",
  });

  if (params.search?.value.trim()) {
    searchParams.set("field", params.search.field);
    searchParams.set("operator", params.search.operator);
    searchParams.set("value", params.search.value.trim());
  }

  if (params.status && params.status !== "all") {
    searchParams.set("active", String(params.status === "active"));
  }

  if (params.branch && params.branch !== "all") {
    searchParams.set("branchId", String(portalBranchToId(params.branch)));
  }

  if (params.roleId && params.roleId !== "all") {
    searchParams.set("roleId", String(params.roleId));
  }

  return searchParams.toString();
}

function buildUserWritePayload(
  values: UserFormValues,
  options: { userId?: number; requirePassword?: boolean } = {},
): ApiUserWritePayload {
  const userName = values.username.trim();
  const email = values.email.trim() || userName;
  const fullName = values.name.trim() || userName;
  const password = values.password.trim();
  const branchId = portalBranchToId(values.branch);

  if (!userName) {
    throw new Error("Username is required.");
  }

  if (options.requirePassword && !password) {
    throw new Error("Password is required.");
  }

  if (!values.roleId) {
    throw new Error("Role is required.");
  }

  const payload: ApiUserWritePayload = {
    accessCode: 0,
    active: statusToActive(values.status),
    branch: { id: branchId },
    branches: [{ id: branchId }],
    email,
    fullName,
    role: { id: values.roleId },
    userName,
    user: userName,
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

  return payload;
}

function formValuesToCreateUserPayload(values: UserFormValues): ApiUserWritePayload {
  return buildUserWritePayload(values, { requirePassword: true });
}

function formValuesToUpdateUserPayload(values: UserFormValues, userId: number): ApiUserWritePayload {
  return buildUserWritePayload(values, { userId });
}

function parseUserPathId(userId: string): number {
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

  const userName = values.username.trim();
  if (userName) {
    const matches = await fetchUsers({
      page: 1,
      limit: 1,
      search: { field: "userName", operator: "equals", value: userName },
    });

    const matchedUser = matches.items[0];
    if (matchedUser) {
      return matchedUser;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create user.");
}

export async function fetchUsers(params: UserListParams = {}): Promise<PaginatedResult<User>> {
  const query = buildUsersQuery(params);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.USERS}?${query}`,
  );

  return normalizePaginatedUsers(response);
}

export async function fetchUserById(userId: string): Promise<User> {
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

export async function updateUser(userId: string, values: UserFormValues): Promise<User> {
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

  return fetchUserById(String(numericId));
}

export async function deleteUser(userId: string): Promise<void> {
  const numericId = parseUserPathId(userId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.USERS}/${numericId}`,
  );

  assertMutationSuccess(response, "Unable to delete user.");
}

export async function deleteUsers(userIds: string[]): Promise<void> {
  await Promise.all(userIds.map((userId) => deleteUser(userId)));
}
