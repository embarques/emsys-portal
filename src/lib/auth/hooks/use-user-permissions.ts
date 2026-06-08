"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchUserPermissions } from "@/lib/auth/api/permissions-api";
import { queryKeys } from "@/lib/query/query-keys";

export function useUserPermissions(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.permissions.user(),
    queryFn: fetchUserPermissions,
    enabled,
  });
}
