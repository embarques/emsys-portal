"use client";

import { useMemo } from "react";

import { useChecks } from "@/lib/accounting/checks/hooks/use-checks";
import { DEFAULT_CHECK_LIST_PARAMS, type Check } from "@/lib/accounting/checks/types";
import { createApiListTextSearch } from "@/lib/api/search-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  notificationActivityId,
  notificationCheckId,
} from "@/lib/notifications/seen-store";
import { useUserActivities } from "@/lib/user-activities/hooks/use-user-activities";
import type { UserActivity } from "@/lib/user-activities/types";

export type NotificationItem =
  | {
      id: string;
      kind: "rare-activity";
      href: "/user-activities";
      activity: UserActivity;
      createdAt: string;
    }
  | {
      id: string;
      kind: "outstanding-check";
      href: "/accounting/checks";
      check: Check;
      createdAt: string;
    };

const RARE_ACTIVITY_PARAMS = {
  page: 1,
  limit: 20,
  sort: "timestamp:desc" as const,
  search: createApiListTextSearch("rare", "severity", "eq"),
};

const OUTSTANDING_CHECK_PARAMS = {
  ...DEFAULT_CHECK_LIST_PARAMS,
  page: 1,
  limit: 20,
  sort: "createdAt:desc" as const,
  search: { field: "status", operator: "eq" as const, value: "OUTSTANDING" },
};

export function useTopbarNotifications(options: { enabled?: boolean } = {}) {
  const { hasPermission } = useAuth();
  const canViewActivities = hasPermission(
    PERMISSIONS.userActivitiesView.name,
    PERMISSIONS.userActivitiesView.resourceType,
  );
  const canViewChecks = hasPermission(
    PERMISSIONS.checksList.name,
    PERMISSIONS.checksList.resourceType,
  );
  const enabled = options.enabled ?? true;

  const activitiesQuery = useUserActivities(RARE_ACTIVITY_PARAMS, {
    enabled: enabled && canViewActivities,
  });
  const checksQuery = useChecks(OUTSTANDING_CHECK_PARAMS, {
    enabled: enabled && canViewChecks,
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

    for (const check of checksQuery.data?.items ?? []) {
      if (check.status !== "OUTSTANDING") continue;
      next.push({
        id: notificationCheckId(check.id),
        kind: "outstanding-check",
        href: "/accounting/checks",
        check,
        createdAt: check.createdAt || check.datePosted,
      });
    }

    return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [activitiesQuery.data?.items, checksQuery.data?.items]);

  return {
    items,
    isLoading: (canViewActivities && activitiesQuery.isLoading) || (canViewChecks && checksQuery.isLoading),
    canViewActivities,
    canViewChecks,
  };
}
