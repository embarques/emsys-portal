"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  createRole,
  deleteRole,
  deleteRoles,
  fetchPermissionCatalog,
  fetchRoleById,
  fetchRoles,
  updateRole,
} from "@/lib/roles/api/roles-api";
import { hasListTextSearch } from "@/lib/api/search-query";
import { ROLE_TABLE_FILTER_FIELDS } from "@/lib/roles/filter-fields";
import { isCompleteFilterRow } from "@/lib/table/filter-builder";
import { queryKeys } from "@/lib/query/query-keys";
import {
  DEFAULT_ROLE_LIST_PARAMS,
  type RoleFormValues,
  type RoleListParams,
} from "@/lib/roles/types";

function isRoleListFiltered(params: RoleListParams): boolean {
  const hasRowFilters = (params.filterRows ?? []).some((row) =>
    isCompleteFilterRow(row, ROLE_TABLE_FILTER_FIELDS),
  );

  return hasListTextSearch(params.search) || hasRowFilters;
}

export function useRoles(params: RoleListParams, options: { enabled?: boolean } = {}) {
  const isFiltered = isRoleListFiltered(params);

  return useWorkspaceQuery({
    queryKey: queryKeys.roles.list(params),
    queryFn: () => fetchRoles(params),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    staleTime: isFiltered ? 0 : 60_000,
  });
}

export function useRoleStats() {
  const totalQuery = useWorkspaceQuery({
    queryKey: queryKeys.roles.stats("all"),
    queryFn: () => fetchRoles({ ...DEFAULT_ROLE_LIST_PARAMS, limit: 1 }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    isLoading: totalQuery.isLoading,
    isError: totalQuery.isError,
  };
}

export function useRoleKpis() {
  const query = useWorkspaceQuery({
    queryKey: queryKeys.roles.stats("kpis"),
    queryFn: () => fetchRoles({ ...DEFAULT_ROLE_LIST_PARAMS, limit: 200 }),
  });

  return {
    items: query.data?.items ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useRolePermissionCatalog() {
  return useWorkspaceQuery({
    queryKey: queryKeys.permissions.catalog(),
    queryFn: fetchPermissionCatalog,
    staleTime: 5 * 60_000,
  });
}

/** Load one role via GET /roles/{id} (permissions hydrated like list/search). */
export function useRole(roleId: string | number | null, enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.roles.detail(String(roleId ?? "")),
    queryFn: () => fetchRoleById(roleId!),
    enabled: enabled && roleId != null && String(roleId).trim() !== "",
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
    onSuccess: (_data, variables) => {
      invalidateRoles(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.roles.detail(String(variables.roleId)),
      });
    },
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
