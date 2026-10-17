"use client";

import { useMemo } from "react";

import { useChecks } from "@/lib/accounting/checks/hooks/use-checks";
import { DEFAULT_CHECK_LIST_PARAMS, type Check } from "@/lib/accounting/checks/types";
import {
  CREDIT_CARD_PAYMENTS_CONFIG,
  DEPOSITS_CONFIG,
  ZELLE_PAYMENTS_CONFIG,
  type ClearablePaymentMethodConfig,
} from "@/lib/accounting/clearable-payments/configs";
import { useClearablePayments } from "@/lib/accounting/clearable-payments/hooks";
import {
  DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS,
  type ClearablePayment,
} from "@/lib/accounting/clearable-payments/types";
import { createApiListTextSearch } from "@/lib/api/search-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  notificationActivityId,
  notificationCheckId,
  notificationClearablePaymentId,
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
    }
  | {
      id: string;
      kind: "outstanding-payment";
      href: string;
      config: ClearablePaymentMethodConfig;
      payment: ClearablePayment;
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

const OUTSTANDING_PAYMENT_PARAMS = {
  ...DEFAULT_CLEARABLE_PAYMENT_LIST_PARAMS,
  page: 1,
  limit: 20,
  sort: "createdAt:desc" as const,
  search: { field: "status", operator: "eq" as const, value: "OUTSTANDING" },
};

function useOutstandingPaymentsNotifications(config: ClearablePaymentMethodConfig, enabled: boolean) {
  const { hasPermission } = useAuth();
  const canList = hasPermission(config.permissions.list.name, config.permissions.list.resourceType);
  const query = useClearablePayments(config, OUTSTANDING_PAYMENT_PARAMS, {
    enabled: enabled && canList,
  });

  return { config, canList, query };
}

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
  const zelle = useOutstandingPaymentsNotifications(ZELLE_PAYMENTS_CONFIG, enabled);
  const deposits = useOutstandingPaymentsNotifications(DEPOSITS_CONFIG, enabled);
  const creditCards = useOutstandingPaymentsNotifications(CREDIT_CARD_PAYMENTS_CONFIG, enabled);
  const paymentSources = [zelle, deposits, creditCards];

  const zelleItems = zelle.query.data?.items;
  const depositItems = deposits.query.data?.items;
  const creditCardItems = creditCards.query.data?.items;

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

    const paymentGroups: Array<[ClearablePaymentMethodConfig, ClearablePayment[] | undefined]> = [
      [ZELLE_PAYMENTS_CONFIG, zelleItems],
      [DEPOSITS_CONFIG, depositItems],
      [CREDIT_CARD_PAYMENTS_CONFIG, creditCardItems],
    ];

    for (const [config, payments] of paymentGroups) {
      for (const payment of payments ?? []) {
        if (payment.status !== "OUTSTANDING") continue;
        next.push({
          id: notificationClearablePaymentId(config.queryKeySegment, payment.id),
          kind: "outstanding-payment",
          href: config.href,
          config,
          payment,
          createdAt: payment.createdAt || payment.datePosted,
        });
      }
    }

    return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [activitiesQuery.data?.items, checksQuery.data?.items, zelleItems, depositItems, creditCardItems]);

  return {
    items,
    isLoading:
      (canViewActivities && activitiesQuery.isLoading) ||
      (canViewChecks && checksQuery.isLoading) ||
      paymentSources.some((source) => source.canList && source.query.isLoading),
    canViewActivities,
    canViewChecks,
  };
}
