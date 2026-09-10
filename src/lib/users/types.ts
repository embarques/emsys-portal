import type { ApiListSortInput } from "@/lib/api/list-query";
import { createApiListTextSearch, createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";

export type UserReference = {
  id: number;
  name: string;
};

/** Branch reference for a user: `{ id, name }` (API `user.BranchRef`). */
export type UserBranch = {
  id: number;
  name: string;
};

export type UserAuditActor = UserReference;

export type User = {
  id: number;
  uid: string;
  email: string;
  name: string;
  active: boolean;
  branch: UserBranch;
  role: UserReference;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
  createdBy: UserAuditActor | null;
  updatedBy: UserAuditActor | null;
};

export type UserFormValues = {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
  active: boolean;
  branch: UserBranch;
  role: UserReference;
  restrictLoginHours: boolean;
  startTime: string;
  endTime: string;
};

export type UserWritePayload = {
  uid?: string;
  email: string;
  name: string;
  active: boolean;
  branch: UserBranch;
  role: UserReference;
  startTime?: string;
  endTime?: string;
};

export type UserFilterState = {
  query: string;
  rows: TableFilterRowState[];
};

export type UserSearchOperator = "eq" | "neq" | "contains" | "startsWith";
export type UserSearchField =
  | "name"
  | "email"
  | "uid"
  | "active"
  | "role.name"
  | "branch.id";
export type UserSearchFilter = ApiListTextSearch;

export type UserListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: UserSearchFilter;
  filterRows?: TableFilterRowState[];
  branch?: number | "all";
  active?: boolean | "all";
  roleId?: number | "all";
};

export type UserListResult = {
  items: User[];
  page: number;
  resultsPerPage: number;
  total: number;
};

export const DEFAULT_USER_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "name:asc",
} as const satisfies Pick<UserListParams, "page" | "limit" | "sort">;

export const USER_ACTIVE_OPTIONS = [
  { value: true, label: "Active" },
  { value: false, label: "Inactive" },
] as const;

export function createUserSearchFilter(
  value: string,
  field?: UserSearchField,
  operator: UserSearchOperator = "contains",
): UserSearchFilter | undefined {
  return field ? createApiListTextSearch(value, field, operator) : createListTextSearch(value);
}

export function buildUserListParams(input: {
  page: number;
  limit?: number;
  query: string;
  rows: TableFilterRowState[];
  sort?: ApiListSortInput;
}): UserListParams {
  const params: UserListParams = {
    ...DEFAULT_USER_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_USER_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_USER_LIST_PARAMS.sort,
  };
  const search = createUserSearchFilter(input.query);
  if (search) params.search = search;
  const completeRows = input.rows.filter((row) => isCompleteFilterRow(row));
  if (completeRows.length) params.filterRows = completeRows;
  return params;
}

export function createEmptyUserForm(): UserFormValues {
  return {
    email: "",
    name: "",
    password: "",
    confirmPassword: "",
    active: true,
    branch: { id: 0, name: "" },
    role: { id: 0, name: "" },
    restrictLoginHours: false,
    startTime: "",
    endTime: "",
  };
}

export function userToFormValues(user: User): UserFormValues {
  return {
    email: user.email,
    name: user.name,
    password: "",
    confirmPassword: "",
    active: user.active,
    branch: { ...user.branch },
    role: { ...user.role },
    restrictLoginHours: Boolean(user.startTime || user.endTime),
    startTime: user.startTime,
    endTime: user.endTime,
  };
}

export function areUserFormValuesEquivalent(
  left: UserFormValues,
  right: UserFormValues,
): boolean {
  return areFormValuesEquivalent(left, right);
}


export function isAdminRole(roleName: string): boolean {
  const normalized = roleName.trim().toLowerCase();
  return normalized.includes("admin") || normalized.includes("administrador");
}
