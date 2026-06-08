"use client";

import type { Permission } from "@/lib/auth/types/permission";
import { useAuth } from "@/lib/auth/hooks/use-auth";

type PermissionGuardProps = {
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
};

export function PermissionGuard({ permission, fallback = null, children }: PermissionGuardProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission.name, permission.resourceType)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
