"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createRole,
  deleteRole,
  deleteRoles,
  fetchPermissionCatalog,
  fetchRoles,
  updateRole,
} from "@/lib/roles/api/roles-api";
import { queryKeys } from "@/lib/query/query-keys";
import type { RoleFormValues } from "@/lib/roles/types";

export function useRoles() {
  return useQuery({
    queryKey: queryKeys.roles.list(),
    queryFn: fetchRoles,
    staleTime: 60_000,
  });
}

export function useRolePermissionCatalog() {
  return useQuery({
    queryKey: queryKeys.permissions.catalog(),
    queryFn: fetchPermissionCatalog,
    staleTime: 5 * 60_000,
  });
}

function invalidateRoles(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRole,
    onSuccess: () => invalidateRoles(queryClient),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, values }: { roleId: string; values: RoleFormValues }) =>
      updateRole(roleId, values),
    onSuccess: () => invalidateRoles(queryClient),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRole,
    onSuccess: () => invalidateRoles(queryClient),
  });
}

export function useDeleteRoles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRoles,
    onSuccess: () => invalidateRoles(queryClient),
  });
}
