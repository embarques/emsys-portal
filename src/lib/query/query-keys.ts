import type { BranchListParams, BranchSearchFilter } from "@/lib/branches/types";
import type { CustomerListParams, CustomerSearchFilter } from "@/lib/customers/types";
import type { EmployeeListParams, EmployeeSearchFilter } from "@/lib/employees/types";
import type { OrderListParams, OrderSearchFilter } from "@/lib/orders/types";
import type { UserListParams, UserSearchField, UserSearchFilter, UserSearchOperator } from "@/lib/users/types";

type OrderSearchQueryOptions = Pick<OrderListParams, "branch" | "completed">;

type UserSearchQueryOptions = Pick<UserListParams, "branch" | "active" | "roleId">;

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
  branches: {
    all: ["branches"] as const,
    lists: () => [...queryKeys.branches.all, "list"] as const,
    list: (params: BranchListParams) => [...queryKeys.branches.lists(), params] as const,
    search: (search: BranchSearchFilter | undefined, limit: number) =>
      [...queryKeys.branches.all, "search", search, limit] as const,
    stats: (scope: "all") => [...queryKeys.branches.all, "stats", scope] as const,
    detail: (branchId: number) => [...queryKeys.branches.all, "detail", branchId] as const,
  },
  orders: {
    all: ["orders"] as const,
    lists: () => [...queryKeys.orders.all, "list"] as const,
    list: (params: OrderListParams) => [...queryKeys.orders.lists(), params] as const,
    search: (search: OrderSearchFilter | undefined, limit: number, options: OrderSearchQueryOptions = {}) =>
      [...queryKeys.orders.all, "search", search, limit, options] as const,
    stats: (scope: "all" | "usa" | "dr" | "pending", branchId?: number) =>
      [...queryKeys.orders.all, "stats", scope, branchId] as const,
    detail: (orderId: string) => [...queryKeys.orders.all, "detail", orderId] as const,
  },
  customers: {
    all: ["customers"] as const,
    lists: () => [...queryKeys.customers.all, "list"] as const,
    list: (params: CustomerListParams) => [...queryKeys.customers.lists(), params] as const,
    search: (search: CustomerSearchFilter | undefined, limit: number) =>
      [...queryKeys.customers.all, "search", search, limit] as const,
    stats: (scope: "all" | "active" | "inactive" | "type1") =>
      [...queryKeys.customers.all, "stats", scope] as const,
    detail: (customerId: string) => [...queryKeys.customers.all, "detail", customerId] as const,
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
