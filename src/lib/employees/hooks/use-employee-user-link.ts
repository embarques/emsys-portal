"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useAppSelector } from "@/lib/store/hooks";
import {
  fetchEmployees,
  linkEmployeeUser,
} from "@/lib/employees/api/employees-api";
import { createEmployeeSearchFilter } from "@/lib/employees/types";
import { fetchUsers } from "@/lib/users/api/users-api";
import { createUserSearchFilter } from "@/lib/users/types";

export function useEmployeeUserLink(
  target: "employee" | "user",
  search: string,
  enabled: boolean,
) {
  const { companyId, user } = useAuth();
  const contextVersion = useAppSelector((state) => state.auth.contextVersion);
  const client = useQueryClient();
  const candidates = useWorkspaceQuery({
    queryKey: [
      "employee-user-link",
      companyId,
      user?.uid,
      contextVersion,
      target,
      search,
    ],
    enabled: enabled && Boolean(companyId && user),
    queryFn: async ({ signal }) => {
      const params = { page: 1, limit: 25, active: true, sort: "name:asc" };
      const page =
        target === "employee"
          ? await fetchEmployees(
              { ...params, search: createEmployeeSearchFilter(search, "name") },
              signal,
            )
          : await fetchUsers(
              {
                ...params,
                search: createUserSearchFilter(search, "name", "contains"),
              },
              signal,
            );
      return page.items.map((item) => ({
        value: String(item.id),
        label: `${item.name} (#${item.id})`,
      }));
    },
  });
  const mutation = useMutation({
    mutationFn: ({
      employeeId,
      userId,
    }: {
      employeeId: number;
      userId: number;
    }) => linkEmployeeUser(employeeId, userId),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.employees.all }),
        client.invalidateQueries({
          queryKey: ["responsibility-employee", companyId],
        }),
        client.invalidateQueries({
          queryKey: [...queryKeys.invoices.all, "assigned-context", companyId],
        }),
      ]);
    },
  });
  return { candidates, mutation };
}
