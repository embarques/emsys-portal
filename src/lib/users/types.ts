import type { ApiListSortInput } from "@/lib/api/list-query";

export type UserPortalBranch = "usa" | "dr";

export type UserPermission = {
  id: number;
  name: string;
  resourceType: string;
  create: boolean;
  view: boolean;
  update: boolean;
  delete: boolean;
  print: boolean;
};

export type UserRole = {
  id: number;
  name: string;
  active: boolean;
  permissions: UserPermission[];
  createdAt: string;
  updatedAt: string;
};

export type UserBranch = {
  id: number;
  name: string;
  code: string;
};

export type User = {
  id: number;
  uid: string;
  email: string;
  userName: string;
  fullName: string;
  password: string;
  active: boolean;
  branch: UserBranch;
  startTime: string;
  endTime: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
  user: string | null;
  accessCode: number;
  type: string;
};

export type UserFormValues = {
  id: number;
  uid: string;
  email: string;
  userName: string;
  fullName: string;
  password: string;
  active: boolean;
  branch: UserBranch;
  startTime: string;
  endTime: string;
  role: Pick<UserRole, "id" | "name">;
  accessCode: number;
  type: string;
  user: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserFilterState = {
  query: string;
  searchField: UserSearchField;
  searchOperator: UserSearchOperator;
  branch: number | "all";
  active: boolean | "all";
  roleId: number | "all";
};

/** Matches GET /users filter operators from the API spec. */
export type UserSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type UserSearchField =
  | "userName"
  | "fullName"
  | "email"
  | "uid"
  | "active"
  | "type"
  | "role.name"
  | "branch.id";

export type UserSearchFilter = {
  field: UserSearchField;
  operator: UserSearchOperator;
  value: string;
};

export type UserListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: UserSearchFilter;
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

/** GET /users?page=1&limit=40&offset=0&sort=userName:asc */
export const DEFAULT_USER_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "userName:asc",
} as const satisfies Pick<UserListParams, "page" | "limit" | "sort">;

const BRANCH_ID_TO_PORTAL: Record<number, UserPortalBranch> = {
  1: "usa",
  2: "dr",
};

const BRANCH_CODE_TO_PORTAL: Record<string, UserPortalBranch> = {
  NY: "usa",
  DR: "dr",
  DO: "dr",
};

export const USER_PORTAL_BRANCHES: {
  portal: UserPortalBranch;
  id: number;
  label: string;
  code: string;
}[] = [
  { portal: "usa", id: 1, label: "USA", code: "NY" },
  { portal: "dr", id: 2, label: "DR", code: "DR" },
];

/**
 * GET /users field + operator pairs verified against the live API.
 * Nested branch/role._id/_id filters return 400 on GET — use POST /users/search instead.
 */
export const USER_GET_SEARCH_CAPABILITIES: {
  field: UserSearchField;
  label: string;
  operators: UserSearchOperator[];
}[] = [
  { field: "userName", label: "userName", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "fullName", label: "fullName", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "email", label: "email", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "uid", label: "uid", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "active", label: "active", operators: ["eq", "neq"] },
  { field: "type", label: "type", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "role.name", label: "role.name", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "branch.id", label: "branch.id", operators: ["eq", "neq"] },
];

export const USER_SEARCH_FIELDS: { value: UserSearchField; label: string }[] =
  USER_GET_SEARCH_CAPABILITIES.map(({ field, label }) => ({ value: field, label }));

export const USER_SEARCH_OPERATORS: { value: UserSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
];

export const USER_ACTIVE_OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: "Active" },
  { value: false, label: "Inactive" },
];

export const USER_ROLE_OPTIONS: { id: number; label: string }[] = [
  { id: 1, label: "Administrador" },
];

/** Operators allowed for a GET /users search field (verified API combinations only). */
export function getUserSearchOperatorsForField(field: UserSearchField): UserSearchOperator[] {
  return USER_GET_SEARCH_CAPABILITIES.find((entry) => entry.field === field)?.operators ?? ["eq"];
}

export function getDefaultUserSearchOperator(field: UserSearchField): UserSearchOperator {
  return getUserSearchOperatorsForField(field)[0];
}

export function normalizeUserSearchFilter(search: UserSearchFilter): UserSearchFilter {
  const allowedOperators = getUserSearchOperatorsForField(search.field);
  const operator = allowedOperators.includes(search.operator)
    ? search.operator
    : getDefaultUserSearchOperator(search.field);

  return { field: search.field, operator, value: search.value };
}

export function createUserSearchFilter(
  value: string,
  field: UserSearchField = "userName",
  operator: UserSearchOperator = "startsWith",
): UserSearchFilter | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let normalizedValue = trimmed;
  if (field === "active") {
    const lower = trimmed.toLowerCase();
    if (["active", "true", "yes"].includes(lower)) normalizedValue = "true";
    if (["inactive", "false", "no"].includes(lower)) normalizedValue = "false";
  }

  return normalizeUserSearchFilter({ field, operator, value: normalizedValue });
}

export function getUserSearchSort(field: UserSearchField, direction: "asc" | "desc" = "asc"): string {
  switch (field) {
    case "fullName":
      return `fullName:${direction}`;
    case "email":
      return `email:${direction}`;
    case "uid":
      return `uid:${direction}`;
    case "type":
      return `type:${direction}`;
    case "role.name":
      return `role.name:${direction}`;
    case "active":
      return `active:${direction}`;
    case "branch.id":
      return `branch.id:${direction}`;
    default:
      return `userName:${direction}`;
  }
}

export function createEmptyUserRole(): UserRole {
  return {
    id: 0,
    name: "",
    active: true,
    permissions: [],
    createdAt: "",
    updatedAt: "",
  };
}

export function createUserBranchFromPortal(portal: UserPortalBranch): UserBranch {
  const config = USER_PORTAL_BRANCHES.find((entry) => entry.portal === portal) ?? USER_PORTAL_BRANCHES[0];

  return {
    id: config.id,
    name: config.label,
    code: config.code,
  };
}

export function getUserPortalBranch(user: Pick<User, "branch">): UserPortalBranch {
  if (BRANCH_ID_TO_PORTAL[user.branch.id]) {
    return BRANCH_ID_TO_PORTAL[user.branch.id];
  }

  const code = user.branch.code.trim().toUpperCase();
  if (code && BRANCH_CODE_TO_PORTAL[code]) {
    return BRANCH_CODE_TO_PORTAL[code];
  }

  return "usa";
}

export function portalBranchToId(portal: UserPortalBranch): number {
  return USER_PORTAL_BRANCHES.find((entry) => entry.portal === portal)?.id ?? 1;
}

export function createEmptyUserForm(): UserFormValues {
  const branch = createUserBranchFromPortal("usa");
  const defaultRole = USER_ROLE_OPTIONS[0];

  return {
    id: 0,
    uid: "",
    email: "",
    userName: "",
    fullName: "",
    password: "",
    active: true,
    branch,
    startTime: "",
    endTime: "",
    role: {
      id: defaultRole?.id ?? 1,
      name: defaultRole?.label ?? "",
    },
    accessCode: 0,
    type: "",
    user: null,
    createdAt: "",
    updatedAt: "",
  };
}

export function userToFormValues(user: User): UserFormValues {
  return {
    id: user.id,
    uid: user.uid,
    userName: user.userName,
    password: "",
    fullName: user.fullName,
    active: user.active,
    role: {
      id: user.role.id,
      name: user.role.name,
    },
    branch: { ...user.branch },
    startTime: user.startTime,
    endTime: user.endTime,
    email: user.email,
    accessCode: user.accessCode,
    type: user.type,
    user: user.user,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function maskPassword(_password: string): string {
  return "••••••••";
}

export function isAdminRole(roleName: string): boolean {
  const normalized = roleName.trim().toLowerCase();
  return normalized.includes("admin") || normalized.includes("administrador");
}
