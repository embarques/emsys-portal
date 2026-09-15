"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import { createEmployeeDepartment, updateEmployeeDepartment, deleteEmployeeDepartment, fetchAllEmployeeDepartments, fetchEmployeeDepartment } from "@/lib/employee-departments/api/employee-departments-api";
import type { EmployeeDepartmentFormValues } from "@/lib/employee-departments/types";
export function useEmployeeDepartments() {
  return useWorkspaceQuery({ queryKey: queryKeys.employeeDepartments.list(), queryFn: fetchAllEmployeeDepartments });
}
export function useEmployeeDepartment(id: number | null) {
  return useWorkspaceQuery({ queryKey: queryKeys.employeeDepartments.detail(id ?? 0), queryFn: () => fetchEmployeeDepartment(id!), enabled: id != null });
}
export function useEmployeeDepartmentMutations() {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.employeeDepartments.all });
  const create = useMutation({ mutationFn: createEmployeeDepartment, onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ id, values }: { id: number; values: EmployeeDepartmentFormValues }) => updateEmployeeDepartment(id, values), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: deleteEmployeeDepartment, onSuccess: invalidate });
  return { create, update, remove };
}
