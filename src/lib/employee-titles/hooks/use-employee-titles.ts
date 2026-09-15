"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import { createEmployeeTitle, updateEmployeeTitle, deleteEmployeeTitle, fetchAllEmployeeTitles, fetchEmployeeTitle } from "@/lib/employee-titles/api/employee-titles-api";
import type { EmployeeTitleFormValues } from "@/lib/employee-titles/types";
export function useEmployeeTitles() {
  return useWorkspaceQuery({ queryKey: queryKeys.employeeTitles.list(), queryFn: fetchAllEmployeeTitles });
}
export function useEmployeeTitle(id: number | null) {
  return useWorkspaceQuery({ queryKey: queryKeys.employeeTitles.detail(id ?? 0), queryFn: () => fetchEmployeeTitle(id!), enabled: id != null });
}
export function useEmployeeTitleMutations() {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.employeeTitles.all });
  const create = useMutation({ mutationFn: createEmployeeTitle, onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, values }: { id: number; values: EmployeeTitleFormValues }) => updateEmployeeTitle(id, values), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: deleteEmployeeTitle, onSuccess: invalidate });
  return { create, update, remove };
}
