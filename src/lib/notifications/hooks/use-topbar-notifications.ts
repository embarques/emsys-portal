"use client";

import { useMemo } from "react";

import { createApiListTextSearch } from "@/lib/api/search-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { notificationActivityId } from "@/lib/notifications/seen-store";
import { useUserActivities } from "@/lib/user-activities/hooks/use-user-activities";
import type { UserActivity } from "@/lib/user-activities/types";

export type NotificationItem = {
  id: string;
  kind: "rare-activity";
  href: "/user-activities";
  activity: UserActivity;
  createdAt: string;
};

const RARE_ACTIVITY_PARAMS = {
  page: 1,
  limit: 20,
  sort: "timestamp:desc" as const,
  search: createApiListTextSearch("rare", "severity", "eq"),
};

export function useTopbarNotifications(options: { enabled?: boolean } = {}) {
  const { hasPermission } = useAuth();
  const canViewActivities = hasPermission(
    PERMISSIONS.userActivitiesView.name,
    PERMISSIONS.userActivitiesView.resourceType,
  );
  const enabled = options.enabled ?? true;

  const activitiesQuery = useUserActivities(RARE_ACTIVITY_PARAMS, {
    enabled: enabled && canViewActivities,
  });

  const items = useMemo(() => {
    const next: NotificationItem[] = [];

    for (const activity of activitiesQuery.data?.items ?? []) {
      if (activity.severity !== "rare") continue;
      next.push({
        id: notificationActivityId(activity.activityId),
        kind: "rare-activity",
        href: "/user-activities",
        activity,
        createdAt: activity.timestamp,
      });
    }

    return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [activitiesQuery.data?.items]);

  return {
    items,
    isLoading: canViewActivities && activitiesQuery.isLoading,
    canViewActivities,
  };
}
