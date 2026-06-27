"use client";

import { useQuery } from "@tanstack/react-query";

import {
  DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS,
  fetchEmployeeGroups,
} from "@/lib/employee-groups/api/employee-groups-api";
import { queryKeys } from "@/lib/query/query-keys";

export function useEmployeeGroupPicker(limit = DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS.limit, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.employeeGroups.list({ limit }),
    queryFn: () => fetchEmployeeGroups({ ...DEFAULT_EMPLOYEE_GROUP_LIST_PARAMS, limit }),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}
