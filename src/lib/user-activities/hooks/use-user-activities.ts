"use client";

import { keepPreviousData } from "@tanstack/react-query";

import { fetchUserActivities } from "@/lib/user-activities/api/user-activities-api";
import type { UserActivityListParams } from "@/lib/user-activities/types";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAppSelector } from "@/lib/store/hooks";

function useUserActivitiesQueryEnabled(extraEnabled = true) {
  const { loading, companyId, roleLoading } = useAuth();
  const { idToken, companyId: transportCompanyId } = useAppSelector((state) => state.auth);

  return (
    extraEnabled &&
    !loading &&
    !roleLoading &&
    Boolean(idToken && companyId && transportCompanyId && companyId === transportCompanyId)
  );
}

export function useUserActivities(
  params: UserActivityListParams,
  options: { enabled?: boolean } = {},
) {
  const queryEnabled = useUserActivitiesQueryEnabled(options.enabled ?? true);

  return useWorkspaceQuery({
    queryKey: queryKeys.userActivities.list(params),
    queryFn: () => fetchUserActivities(params),
    enabled: queryEnabled,
    placeholderData: keepPreviousData,
  });
}
