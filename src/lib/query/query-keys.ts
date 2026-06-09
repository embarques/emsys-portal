import type { EmployeeListParams, EmployeeSearchFilter } from "@/lib/employees/types";
import type { UserListParams, UserSearchField, UserSearchFilter, UserSearchOperator } from "@/lib/users/types";

type UserSearchQueryOptions = Pick<UserListParams, "branch" | "status" | "roleId">;

export const queryKeys = {
  permissions: {
    all: ["permissions"] as const,
    user: () => [...queryKeys.permissions.all, "user"] as const,
  },
  employees: {
    all: ["employees"] as const,
    lists: () => [...queryKeys.employees.all, "list"] as const,
    list: (params: EmployeeListParams) => [...queryKeys.employees.lists(), params] as const,
    search: (search: EmployeeSearchFilter | undefined, limit: number) =>
      [...queryKeys.employees.all, "search", search, limit] as const,
    stats: (scope: "all" | "active" | "inactive") =>
      [...queryKeys.employees.all, "stats", scope] as const,
    detail: (employeeId: string) => [...queryKeys.employees.all, "detail", employeeId] as const,
  },
  users: {
    all: ["users"] as const,
    lists: () => [...queryKeys.users.all, "list"] as const,
    list: (params: UserListParams) => [...queryKeys.users.lists(), params] as const,
    search: (
      search: UserSearchFilter | undefined,
      limit: number,
      options: UserSearchQueryOptions = {},
    ) => [...queryKeys.users.all, "search", search, limit, options] as const,
    autocomplete: (
      query: string,
      field: UserSearchField,
      operator: UserSearchOperator,
      options: UserSearchQueryOptions = {},
    ) => [...queryKeys.users.all, "autocomplete", query, field, operator, options] as const,
    stats: (scope: "all" | "active" | "admin", roleId?: number) =>
      [...queryKeys.users.all, "stats", scope, roleId] as const,
    detail: (userId: string) => [...queryKeys.users.all, "detail", userId] as const,
  },
} as const;
