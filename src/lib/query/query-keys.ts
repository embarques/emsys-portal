import type { BranchListParams, BranchSearchFilter } from "@/lib/branches/types";
import type { ContainerListParams, ContainerSearchFilter } from "@/lib/containers/types";
import type { InvoiceListParams, InvoiceSearchFilter } from "@/lib/invoices/types";
import type { ItemListParams, ItemSearchFilter } from "@/lib/items/types";
import type { VehicleListParams, VehicleSearchFilter } from "@/lib/vehicles/types";
import type { RouteListParams, RouteSearchFilter } from "@/lib/routes/types";
import type { CustomerListParams, CustomerSearchFilter } from "@/lib/customers/types";
import type { MemoPadListParams, MemoPadSearchFilter } from "@/lib/memo-pads/types";
import type { EmployeeListParams, EmployeeSearchFilter } from "@/lib/employees/types";
import type { OrderListParams, OrderSearchFilter } from "@/lib/orders/types";
import type { RoleListParams, RoleSearchFilter } from "@/lib/roles/types";
import type { UserListParams, UserSearchField, UserSearchFilter, UserSearchOperator } from "@/lib/users/types";
import type { EmployeeGroupSearchFilter } from "@/lib/employee-groups/api/employee-groups-api";

type UserSearchQueryOptions = Pick<UserListParams, "branch" | "active" | "roleId">;

export const queryKeys = {
  api: {
    health: () => ["api", "health"] as const,
  },
  permissions: {
    all: ["permissions"] as const,
    user: () => [...queryKeys.permissions.all, "user"] as const,
    catalog: () => [...queryKeys.permissions.all, "catalog"] as const,
  },
  roles: {
    all: ["roles"] as const,
    lists: () => [...queryKeys.roles.all, "list"] as const,
    list: (params: RoleListParams) => [...queryKeys.roles.lists(), params] as const,
    search: (search: RoleSearchFilter | undefined, limit: number) =>
      [...queryKeys.roles.all, "search", search, limit] as const,
    stats: (scope: "all" | "kpis") => [...queryKeys.roles.all, "stats", scope] as const,
    detail: (roleId: string) => [...queryKeys.roles.all, "detail", roleId] as const,
  },
  employees: {
    all: ["employees"] as const,
    lists: () => [...queryKeys.employees.all, "list"] as const,
    list: (params: EmployeeListParams) => [...queryKeys.employees.lists(), params] as const,
    search: (search: EmployeeSearchFilter | undefined, limit: number) =>
      [...queryKeys.employees.all, "search", search, limit] as const,
    stats: (scope: "all" | "active" | "inactive" | `branch:${string}`) =>
      [...queryKeys.employees.all, "stats", scope] as const,
    detail: (employeeId: string) => [...queryKeys.employees.all, "detail", employeeId] as const,
  },
  employeeGroups: {
    all: ["employee-groups"] as const,
    lists: () => [...queryKeys.employeeGroups.all, "list"] as const,
    list: (params: { limit?: number }) => [...queryKeys.employeeGroups.lists(), params] as const,
    search: (search: EmployeeGroupSearchFilter | undefined, limit: number) =>
      [...queryKeys.employeeGroups.all, "search", search, limit] as const,
  },
  vehicles: {
    all: ["vehicles"] as const,
    lists: () => [...queryKeys.vehicles.all, "list"] as const,
    list: (params: VehicleListParams) => [...queryKeys.vehicles.lists(), params] as const,
    search: (search: VehicleSearchFilter | undefined, limit: number) =>
      [...queryKeys.vehicles.all, "search", search, limit] as const,
    stats: (scope: "all" | "kpis" | `branch:${string}`) =>
      [...queryKeys.vehicles.all, "stats", scope] as const,
    detail: (vehicleId: string) => [...queryKeys.vehicles.all, "detail", vehicleId] as const,
  },
  routes: {
    all: ["routes"] as const,
    lists: () => [...queryKeys.routes.all, "list"] as const,
    list: (params: RouteListParams) => [...queryKeys.routes.lists(), params] as const,
    search: (search: RouteSearchFilter | undefined, limit: number) =>
      [...queryKeys.routes.all, "search", search, limit] as const,
    stats: (scope: "all" | "kpis", date?: string) =>
      [...queryKeys.routes.all, "stats", scope, ...(date ? [date] : [])] as const,
    detail: (routeId: string) =>
      [...queryKeys.routes.all, "detail", routeId] as const,
  },
  containers: {
    all: ["containers"] as const,
    lists: () => [...queryKeys.containers.all, "list"] as const,
    list: (params: ContainerListParams) => [...queryKeys.containers.lists(), params] as const,
    search: (search: ContainerSearchFilter | undefined, limit: number) =>
      [...queryKeys.containers.all, "search", search, limit] as const,
    stats: (scope: "all" | "kpis") => [...queryKeys.containers.all, "stats", scope] as const,
    detail: (containerId: number) => [...queryKeys.containers.all, "detail", containerId] as const,
  },
  invoices: {
    all: ["invoices"] as const,
    lists: () => [...queryKeys.invoices.all, "list"] as const,
    list: (params: InvoiceListParams) => [...queryKeys.invoices.lists(), params] as const,
    search: (search: InvoiceSearchFilter | undefined, limit: number) =>
      [...queryKeys.invoices.all, "search", search, limit] as const,
    stats: (scope: "outstanding" | "outstanding-balance") =>
      [...queryKeys.invoices.all, "stats", scope] as const,
    detail: (invoiceId: string) => [...queryKeys.invoices.all, "detail", invoiceId] as const,
  },
  accounting: {
    all: ["accounting"] as const,
    incomeStatement: (branchCode: string, date: string) =>
      [...queryKeys.accounting.all, "income-statement", branchCode, date] as const,
    incomeStatementById: (id: number) =>
      [...queryKeys.accounting.all, "income-statement-by-id", id] as const,
    summaryTotals: (incomeStatementId: number) =>
      [...queryKeys.accounting.all, "income-statement-summary-total", incomeStatementId] as const,
    journals: (params: unknown) => [...queryKeys.accounting.all, "journals", params] as const,
    journalById: (id: string) => [...queryKeys.accounting.all, "journal", id] as const,
    accounts: (params: unknown) => [...queryKeys.accounting.all, "accounts", params] as const,
    paymentMethods: () => [...queryKeys.accounting.all, "payment-methods"] as const,
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
    search: (search: OrderSearchFilter | undefined, limit: number) =>
      [...queryKeys.orders.all, "search", search, limit] as const,
    history: (senderId: string, limit: number) =>
      [...queryKeys.orders.all, "history", senderId, limit] as const,
    stats: (
      scope:
        | "pending"
        | "pending-pickups"
        | "pending-takes"
        | "pending-estimates"
        | "pending-payments",
      branchId?: number,
    ) =>
      [...queryKeys.orders.all, "stats", scope, branchId] as const,
    detail: (orderId: string) => [...queryKeys.orders.all, "detail", orderId] as const,
  },
  items: {
    all: ["items"] as const,
    lists: () => [...queryKeys.items.all, "list"] as const,
    list: (params: ItemListParams) => [...queryKeys.items.lists(), params] as const,
    search: (search: ItemSearchFilter | undefined, limit: number) =>
      [...queryKeys.items.all, "search", search, limit] as const,
    stats: (scope: "all" | "kpis") => [...queryKeys.items.all, "stats", scope] as const,
    detail: (itemId: string) => [...queryKeys.items.all, "detail", itemId] as const,
  },
  customers: {
    all: ["customers"] as const,
    lists: () => [...queryKeys.customers.all, "list"] as const,
    list: (params: CustomerListParams) => [...queryKeys.customers.lists(), params] as const,
    search: (
      search: CustomerSearchFilter | undefined,
      limit: number,
      scope: { customerType?: number | "all"; orFields?: readonly string[] } = {},
    ) => [...queryKeys.customers.all, "search", search, limit, scope] as const,
    stats: (scope: "all" | "active" | "inactive" | "senders" | "receivers") =>
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
    current: () => [...queryKeys.users.all, "current"] as const,
  },
  filterPresets: {
    all: ["filter-presets"] as const,
    lists: () => [...queryKeys.filterPresets.all, "list"] as const,
    list: (scope: string) => [...queryKeys.filterPresets.lists(), scope] as const,
    detail: (presetId: string) => [...queryKeys.filterPresets.all, "detail", presetId] as const,
  },
  memoPads: {
    all: ["memo-pads"] as const,
    lists: () => [...queryKeys.memoPads.all, "list"] as const,
    list: (params: MemoPadListParams) => [...queryKeys.memoPads.lists(), params] as const,
    search: (search: MemoPadSearchFilter | undefined, limit: number) =>
      [...queryKeys.memoPads.all, "search", search, limit] as const,
    detail: (memoPadId: string) => [...queryKeys.memoPads.all, "detail", memoPadId] as const,
  },
} as const;
