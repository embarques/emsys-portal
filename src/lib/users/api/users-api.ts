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
  active?: boolean;
  role?: ApiUserRole;
  branch?: ApiUserBranch;
  phone?: string;
  language?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
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

  return {
    userId: String(userId),
    uid: String(item.uid ?? "").trim(),
    username,
    password: "",
    name: username || email,
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

function formValuesToApiPayload(values: UserFormValues, includePassword: boolean): ApiUser {
  const payload: ApiUser = {
    userName: values.username.trim(),
    email: values.email.trim() || values.username.trim(),
    active: statusToActive(values.status),
    uid: values.uid.trim() || undefined,
    role: { _id: values.roleId },
    branch: { _id: portalBranchToId(values.branch) },
    phone: values.phone.trim() || undefined,
    language: values.language,
  };

  if (includePassword && values.password.trim()) {
    return { ...payload, password: values.password.trim() } as ApiUser & { password?: string };
  }

  return payload;
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
  const response = await apiClient.post<ApiUser | PaginatedApiEnvelope<ApiUser>>(
    API_ENDPOINTS.USERS,
    formValuesToApiPayload(values, true),
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiUser>).data
      : response;

  const user = normalizeUser(raw);
  if (!user) {
    throw new Error("Unable to create user.");
  }

  return user;
}

export async function updateUser(userId: string, values: UserFormValues): Promise<User> {
  const response = await apiClient.put<ApiUser | PaginatedApiEnvelope<ApiUser>>(
    `${API_ENDPOINTS.USERS}/${userId}`,
    formValuesToApiPayload(values, Boolean(values.password.trim())),
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiUser>).data
      : response;

  const user = normalizeUser(raw);
  if (!user) {
    throw new Error("Unable to update user.");
  }

  return user;
}

export async function deleteUser(userId: string): Promise<void> {
  await apiClient.delete(`${API_ENDPOINTS.USERS}/${userId}`);
}

export async function deleteUsers(userIds: string[]): Promise<void> {
  await Promise.all(userIds.map((userId) => deleteUser(userId)));
}
