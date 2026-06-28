"use client";

import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  createEmployee,
  deleteEmployee,
  deleteEmployees,
  fetchEmployeeById,
  fetchEmployees,
  updateEmployee,
} from "@/lib/employees/api/employees-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import { EMPLOYEE_TABLE_FILTER_FIELDS } from "@/lib/employees/filter-fields";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import {
  DEFAULT_EMPLOYEE_LIST_PARAMS,
  EMPLOYEE_PORTAL_BRANCHES,
  type EmployeeFormValues,
  type EmployeeListParams,
  type EmployeeSearchFilter,
} from "@/lib/employees/types";
import { queryKeys } from "@/lib/query/query-keys";

function isEmployeeListFiltered(params: EmployeeListParams): boolean {
  const hasRowFilters = (params.filterRows ?? []).some((row) =>
    isCompleteFilterRow(row, EMPLOYEE_TABLE_FILTER_FIELDS),
  );
  const hasChipFilters =
    (params.branch !== undefined && params.branch !== "all") ||
    (params.active !== undefined && params.active !== "all") ||
    Boolean(params.department && params.department !== "all");

  return hasListTextSearch(params.search) || hasRowFilters || hasChipFilters;
}

export function useEmployeeSearch(
  search: EmployeeSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useWorkspaceQuery({
    queryKey: queryKeys.employees.search(search, limit),
    queryFn: () =>
      fetchEmployees({
        page: 1,
        limit,
        sort: DEFAULT_EMPLOYEE_LIST_PARAMS.sort,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useEmployees(params: EmployeeListParams) {
  const isFiltered = isEmployeeListFiltered(params);

  return useWorkspaceQuery({
    queryKey: queryKeys.employees.list(params),
    queryFn: () => fetchEmployees(params),
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useEmployeeStats() {
  const totalQuery = useWorkspaceQuery({
    queryKey: queryKeys.employees.stats("all"),
    queryFn: () => fetchEmployees({ page: 1, limit: 1 }),
  });

  const activeQuery = useWorkspaceQuery({
    queryKey: queryKeys.employees.stats("active"),
    queryFn: () => fetchEmployees({ page: 1, limit: 1, active: true }),
  });

  const inactiveQuery = useWorkspaceQuery({
    queryKey: queryKeys.employees.stats("inactive"),
    queryFn: () => fetchEmployees({ page: 1, limit: 1, active: false }),
  });

  const branchQueries = useQueries({
    queries: EMPLOYEE_PORTAL_BRANCHES.map((branch) => ({
      queryKey: queryKeys.employees.stats(`branch:${branch.code}`),
      queryFn: () => fetchEmployees({ page: 1, limit: 1, branch: branch.code }),
    })),
  });

  const branches = EMPLOYEE_PORTAL_BRANCHES.map((branch, index) => ({
    id: branch.id,
    portal: branch.portal,
    label: branch.label,
    total: branchQueries[index]?.data?.total ?? 0,
  }));

  return {
    total: totalQuery.data?.total ?? 0,
    active: activeQuery.data?.total ?? 0,
    inactive: inactiveQuery.data?.total ?? 0,
    branches,
    isLoading:
      totalQuery.isLoading ||
      activeQuery.isLoading ||
      inactiveQuery.isLoading ||
      branchQueries.some((query) => query.isLoading),
    isError:
      totalQuery.isError ||
      activeQuery.isError ||
      inactiveQuery.isError ||
      branchQueries.some((query) => query.isError),
  };
}

export function useEmployee(employeeId: string | null, enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.employees.detail(employeeId ?? ""),
    queryFn: () => fetchEmployeeById(employeeId!),
    enabled: enabled && Boolean(employeeId),
  });
}

function invalidateEmployees(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.employees.all });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: EmployeeFormValues) => createEmployee(values),
    onSuccess: () => invalidateEmployees(queryClient),
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ employeeId, values }: { employeeId: string; values: EmployeeFormValues }) =>
      updateEmployee(employeeId, values),
    onSuccess: (_data, variables) => {
      invalidateEmployees(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.detail(variables.employeeId),
      });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (employeeId: string) => deleteEmployee(employeeId),
    onSuccess: () => invalidateEmployees(queryClient),
  });
}

export function useDeleteEmployees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (employeeIds: string[]) => deleteEmployees(employeeIds),
    onSuccess: () => invalidateEmployees(queryClient),
  });
}
