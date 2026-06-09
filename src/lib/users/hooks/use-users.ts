"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createUser,
  deleteUser,
  deleteUsers,
  fetchUserById,
  fetchUsers,
  updateUser,
} from "@/lib/users/api/users-api";
import {
  createUserSearchFilter,
  getUserSearchSortField,
  type UserFormValues,
  type UserListParams,
  type UserSearchField,
  type UserSearchFilter,
  type UserSearchOperator,
} from "@/lib/users/types";
import { queryKeys } from "@/lib/query/query-keys";

type UserSearchOptions = {
  enabled?: boolean;
  limit?: number;
  branch?: UserListParams["branch"];
  status?: UserListParams["status"];
  roleId?: UserListParams["roleId"];
};

function buildUserSearchParams(
  search: UserSearchFilter | undefined,
  options: UserSearchOptions = {},
): UserListParams {
  const { limit = 40, branch, status, roleId } = options;

  return {
    page: 1,
    limit,
    sortField: search ? getUserSearchSortField(search.field) : "userName",
    sortDirection: "asc",
    search,
    branch,
    status,
    roleId,
  };
}

export function useUserSearch(
  search: UserSearchFilter | undefined,
  options: UserSearchOptions = {},
) {
  const { enabled = true, limit = 40 } = options;

  return useQuery({
    queryKey: queryKeys.users.search(search, limit, options),
    queryFn: () => fetchUsers(buildUserSearchParams(search, options)),
    enabled: enabled && Boolean(search?.value.trim()),
  });
}

export function useUserAutocomplete(
  query: string,
  field: UserSearchField = "userName",
  operator: UserSearchOperator = "startsWith",
  options: UserSearchOptions = {},
) {
  const { enabled = true } = options;
  const search = createUserSearchFilter(query, field, operator);
  const hasQuery = Boolean(query.trim());

  return useQuery({
    queryKey: queryKeys.users.autocomplete(query, field, operator, options),
    queryFn: () => fetchUsers(buildUserSearchParams(hasQuery ? search : undefined, options)),
    enabled,
  });
}

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => fetchUsers(params),
  });
}

export function useUserStats(adminRoleId = 1) {
  const totalQuery = useQuery({
    queryKey: queryKeys.users.stats("all"),
    queryFn: () => fetchUsers({ page: 1, limit: 1 }),
  });

  const activeQuery = useQuery({
    queryKey: queryKeys.users.stats("active"),
    queryFn: () => fetchUsers({ page: 1, limit: 1, status: "active" }),
  });

  const adminQuery = useQuery({
    queryKey: queryKeys.users.stats("admin", adminRoleId),
    queryFn: () => fetchUsers({ page: 1, limit: 1, roleId: adminRoleId }),
  });

  return {
    total: totalQuery.data?.total ?? 0,
    active: activeQuery.data?.total ?? 0,
    admin: adminQuery.data?.total ?? 0,
    isLoading: totalQuery.isLoading || activeQuery.isLoading || adminQuery.isLoading,
    isError: totalQuery.isError || activeQuery.isError || adminQuery.isError,
  };
}

export function useUser(userId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.detail(userId ?? ""),
    queryFn: () => fetchUserById(userId!),
    enabled: enabled && Boolean(userId),
  });
}

function invalidateUsers(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: UserFormValues) => createUser(values),
    onSuccess: () => invalidateUsers(queryClient),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, values }: { userId: string; values: UserFormValues }) =>
      updateUser(userId, values),
    onSuccess: (_data, variables) => {
      invalidateUsers(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.users.detail(variables.userId) });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => invalidateUsers(queryClient),
  });
}

export function useDeleteUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: string[]) => deleteUsers(userIds),
    onSuccess: () => invalidateUsers(queryClient),
  });
}
