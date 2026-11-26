import type { QueryClient } from "@tanstack/react-query";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { queryKeys } from "@/lib/query/query-keys";

export function canUseEmployeeUserLink(hasPermission: (name: string, resourceType: string) => boolean) {
  return [PERMISSIONS.employeeUserLink, PERMISSIONS.employeesView, PERMISSIONS.usersView].every(
    permission => hasPermission(permission.name, permission.resourceType),
  );
}

export function invalidateEmployeeLink(queryClient: QueryClient, companyId: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
    queryClient.invalidateQueries({ queryKey: ["responsibility-employee", companyId] }),
    queryClient.invalidateQueries({ queryKey: [...queryKeys.invoices.all, "assigned-context", companyId] }),
  ]);
}
