"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createEmployee,
  deleteEmployee,
  deleteEmployees,
  fetchEmployeeById,
  fetchEmployees,
  updateEmployee,
} from "@/lib/employees/api/employees-api";
import type { EmployeeFormValues, EmployeeListParams, EmployeeSearchFilter } from "@/lib/employees/types";
import { queryKeys } from "@/lib/query/query-keys";

export function useEmployeeSearch(
  search: EmployeeSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useQuery({
    queryKey: queryKeys.employees.search(search, limit),
    queryFn: () =>
      fetchEmployees({
        page: 1,
        limit,
        sortField: "name",
        sortDirection: "asc",
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useEmployees(params: EmployeeListParams) {
  return useQuery({
    queryKey: queryKeys.employees.list(params),
    queryFn: () => fetchEmployees(params),
  });
}

export function useEmployeeStats() {
  const totalQuery = useQuery({
    queryKey: queryKeys.employees.stats("all"),
    queryFn: () => fetchEmployees({ page: 1, limit: 1 }),
  });

  const activeQuery = useQuery({
    queryKey: queryKeys.employees.stats("active"),
    queryFn: () => fetchEmployees({ page: 1, limit: 1, status: "active" }),
  });

  const inactiveQuery = useQuery({
    queryKey: queryKeys.employees.stats("inactive"),
    queryFn: () => fetchEmployees({ page: 1, limit: 1, status: "inactive" }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    active: activeQuery.data?.total ?? 0,
    inactive: inactiveQuery.data?.total ?? 0,
    isLoading: totalQuery.isLoading || activeQuery.isLoading || inactiveQuery.isLoading,
    isError: totalQuery.isError || activeQuery.isError || inactiveQuery.isError,
  };
}

export function useEmployee(employeeId: string | null, enabled = true) {
  return useQuery({
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
