import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

export type UserBranch = "usa" | "dr";
export type UserStatus = "active" | "inactive";
export type UserLanguage = "en" | "es";

export type User = {
  userId: string;
  uid: string;
  username: string;
  password: string;
  name: string;
  status: UserStatus;
  roleId: number;
  roleName: string;
  language: UserLanguage;
  branch: UserBranch;
  branchCode: string;
  email: string;
  phone: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type UserFormValues = {
  userId: string;
  uid: string;
  username: string;
  password: string;
  name: string;
  status: UserStatus;
  roleId: number;
  language: UserLanguage;
  branch: UserBranch;
  email: string;
  phone: string;
  createdBy: string;
};

export type UserFilterState = {
  query: string;
  searchField: UserSearchField;
  searchOperator: UserSearchOperator;
  branch: UserBranch | "all";
  status: UserStatus | "all";
  roleId: number | "all";
};

export type UserSearchOperator = "startsWith" | "contains" | "equals" | "endsWith";

export type UserSearchField =
  | "_id"
  | "userName"
  | "email"
  | "uid"
  | "active"
  | "phone"
  | "language"
  | "role.name"
  | "role._id"
  | "branch.code"
  | "branch._id";

export type UserSearchFilter = {
  field: UserSearchField;
  operator: UserSearchOperator;
  value: string;
};

export type UserListParams = {
  page?: number;
  limit?: number;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  search?: UserSearchFilter;
  branch?: UserBranch | "all";
  status?: UserStatus | "all";
  roleId?: number | "all";
};

export type UserListResult = {
  items: User[];
  page: number;
  resultsPerPage: number;
  total: number;
};

export const USER_SEARCH_FIELDS: { value: UserSearchField; label: string }[] = [
  { value: "_id", label: "User ID" },
  { value: "userName", label: "Username" },
  { value: "email", label: "Email" },
  { value: "uid", label: "Firebase UID" },
  { value: "active", label: "Active" },
  { value: "phone", label: "Phone" },
  { value: "language", label: "Language" },
  { value: "role.name", label: "Role name" },
  { value: "role._id", label: "Role ID" },
  { value: "branch.code", label: "Branch code" },
  { value: "branch._id", label: "Branch ID" },
];

export const USER_SEARCH_OPERATORS: { value: UserSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "endsWith", label: "Ends with" },
];

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

  return { field, operator, value: normalizedValue };
}

export function getUserSearchSortField(field: UserSearchField): string {
  switch (field) {
    case "email":
      return "email";
    case "uid":
      return "uid";
    case "_id":
      return "_id";
    case "role.name":
      return "role.name";
    case "role._id":
      return "role._id";
    case "branch.code":
      return "branch.code";
    case "branch._id":
      return "branch._id";
    case "phone":
      return "phone";
    case "language":
      return "language";
    case "active":
      return "active";
    default:
      return "userName";
  }
}

export const USER_BRANCHES: { value: UserBranch; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

export const USER_STATUSES: { value: UserStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const USER_ROLE_OPTIONS: { id: number; label: string }[] = [
  { id: 1, label: "Administrador" },
];

export const USER_LANGUAGES: { value: UserLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
];

export function createEmptyUserForm(createdBy = DEFAULT_CREATED_BY): UserFormValues {
  return {
    userId: "",
    uid: "",
    username: "",
    password: "",
    name: "",
    status: "active",
    roleId: USER_ROLE_OPTIONS[0]?.id ?? 1,
    language: "en",
    branch: "usa",
    email: "",
    phone: "",
    createdBy,
  };
}

export function userToFormValues(user: User): UserFormValues {
  return {
    userId: user.userId,
    uid: user.uid,
    username: user.username,
    password: "",
    name: user.name,
    status: user.status,
    roleId: user.roleId,
    language: user.language,
    branch: user.branch,
    email: user.email,
    phone: user.phone,
    createdBy: user.createdBy,
  };
}

export function maskPassword(_password: string): string {
  return "••••••••";
}

export function formatUserBranchLabel(user: User): string {
  const branchLabel = USER_BRANCHES.find((entry) => entry.value === user.branch)?.label ?? user.branch.toUpperCase();
  return user.branchCode ? `${branchLabel} (${user.branchCode})` : branchLabel;
}

export function isAdminRole(roleName: string): boolean {
  const normalized = roleName.trim().toLowerCase();
  return normalized.includes("admin") || normalized.includes("administrador");
}
