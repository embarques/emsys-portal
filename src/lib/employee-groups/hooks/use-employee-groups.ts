"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS,
  createEmployeeGroup,
  deleteEmployeeGroups,
  fetchEmployeeGroups,
  updateEmployeeGroup,
  type EmployeeGroupOption,
  type EmployeeGroupSearchFilter,
} from "@/lib/employee-groups/api/employee-groups-api";
import { queryKeys } from "@/lib/query/query-keys";
import type { PaginatedResult } from "@/lib/api/types";

export function useEmployeeGroups(
  limit: number = DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS.limit,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.employeeGroups.list({ limit }),
    queryFn: () => fetchEmployeeGroups({ ...DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS, limit }),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
  });
}

export function useEmployeeGroupPicker(
  limit: number = DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS.limit,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.employeeGroups.list({ limit }),
    queryFn: () => fetchEmployeeGroups({ ...DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS, limit }),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

export function useEmployeeGroupSearch(
  search: EmployeeGroupSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useQuery({
    queryKey: queryKeys.employeeGroups.search(search, limit),
    queryFn: () =>
      fetchEmployeeGroups({
        ...DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: enabled && Boolean(search?.value.trim()),
    placeholderData: keepPreviousData,
  });
}

export function useCreateEmployeeGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEmployeeGroup,
    onSuccess: async (group) => {
      queryClient.setQueriesData<PaginatedResult<EmployeeGroupOption>>(
        { queryKey: queryKeys.employeeGroups.lists() },
        (current) => {
          if (!current || current.items.some((item) => item.id === group.id)) return current;
          return {
            ...current,
            items: [group, ...current.items],
            total: current.total + 1,
          };
        },
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.employeeGroups.all });
    },
  });
}

export function useUpdateEmployeeGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEmployeeGroup,
    onSuccess: async (group) => {
      queryClient.setQueriesData<PaginatedResult<EmployeeGroupOption>>(
        { queryKey: queryKeys.employeeGroups.lists() },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.map((item) =>
              item.id === group.id ? { ...item, ...group } : item,
            ),
          };
        },
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.employeeGroups.all });
    },
  });
}

export function useDeleteEmployeeGroups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (employeeGroupIds: string[]) => deleteEmployeeGroups(employeeGroupIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.employeeGroups.all }),
  });
}
