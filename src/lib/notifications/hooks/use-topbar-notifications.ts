"use client";

import { useMemo } from "react";

import { createApiListTextSearch } from "@/lib/api/search-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useInvoicePoolLowStock } from "@/lib/invoices/hooks/use-invoice-pool-low-stock";
import { notificationActivityId, notificationInvoicePoolLowId } from "@/lib/notifications/seen-store";
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
      kind: "invoice-pool-low";
      href: "/invoices/reserved";
      remaining: number;
      threshold: number;
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
  const invoicePool = useInvoicePoolLowStock();

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

    next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (enabled && invoicePool.isLow && invoicePool.remaining !== null && invoicePool.threshold !== null) {
      next.unshift({
        id: notificationInvoicePoolLowId(invoicePool.companyId, invoicePool.remaining),
        kind: "invoice-pool-low",
        href: "/invoices/reserved",
        remaining: invoicePool.remaining,
        threshold: invoicePool.threshold,
        createdAt: new Date(invoicePool.updatedAt).toISOString(),
      });
    }

    return next;
  }, [activitiesQuery.data?.items, enabled, invoicePool.companyId, invoicePool.isLow, invoicePool.remaining, invoicePool.threshold, invoicePool.updatedAt]);

  return {
    items,
    isLoading: canViewActivities && activitiesQuery.isLoading,
    canViewActivities,
  };
}
