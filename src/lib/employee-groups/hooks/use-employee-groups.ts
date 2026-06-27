"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS,
  fetchEmployeeGroups,
  type EmployeeGroupSearchFilter,
} from "@/lib/employee-groups/api/employee-groups-api";
import { queryKeys } from "@/lib/query/query-keys";

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
