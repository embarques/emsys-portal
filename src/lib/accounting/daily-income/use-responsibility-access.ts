"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS, permissionKey } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { fetchEmployeeByUserId } from "@/lib/employees/api/employees-api";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { responsibilityPermission } from "./responsibility";

export function useResponsibilityAccess(type: string) {
  const { companyId, user, permissions, hasPermission, loading, permissionsLoading } = useAuth();
  const permission = responsibilityPermission(type);
  const canAssign = !permission || hasPermission(permission.name, permission.resourceType);
  const currentUser = useCurrentUser();
  const ready = !loading && !permissionsLoading;
  const ownEmployee = useWorkspaceQuery({
    queryKey: ["responsibility-employee", companyId, user?.uid, currentUser.data?.id, permissions.map(permissionKey).sort()],
    queryFn: () => fetchEmployeeByUserId(currentUser.data!.id),
    enabled: ready && Boolean(companyId && currentUser.data?.id) && !canAssign &&
      hasPermission(PERMISSIONS.employeesView.name, PERMISSIONS.employeesView.resourceType),
    retry: false,
    staleTime: 60_000,
  });
  const canReadEmployee = hasPermission(PERMISSIONS.employeesView.name, PERMISSIONS.employeesView.resourceType);
  const selfReady = canAssign || currentUser.isError || currentUser.isSuccess && (!canReadEmployee || ownEmployee.isFetched);
  return { canAssign: ready && canAssign, ready: ready && selfReady, ownEmployee: ownEmployee.data ?? null };
}
