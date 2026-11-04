"use client";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useAccountingQueryEnabled } from "@/lib/accounting/daily-income/hooks";
import { fetchOutstandingJournalCount } from "@/lib/accounting/daily-income/reconciliation-api";
import type { JournalQueue } from "@/lib/accounting/daily-income/journal-queue";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import { useTranslation } from "@/lib/i18n";

const reconciliationHref = "/accounting/pending-financial-activity";
const clearanceHref = "/accounting/pending-clearance";
type NavAlertItem = { href?: string; children?: Array<{ href?: string }> };

function hasHref(items: NavAlertItem[], href: string) {
  return items.some(item => item.href === href || item.children?.some(child => child.href === href));
}

export function useOutstandingJournalCount(queue: JournalQueue = "reconciliation", active = true) {
  const { companyId, hasPermission } = useAuth();
  const ready = useAccountingQueryEnabled();
  const query = useWorkspaceQuery({
    queryKey: [...queryKeys.accounting.all, "outstanding-journal-count", companyId, queue],
    queryFn: ({ signal }) => fetchOutstandingJournalCount(signal, queue),
    enabled: active && ready && hasPermission("canViewJournal", "journal"),
    staleTime: 30_000,
  });
  return active ? query.data ?? 0 : 0;
}

export function useNavAlertCount(href?: string) {
  return useOutstandingJournalCount(href === clearanceHref ? "clearance" : "reconciliation", href === reconciliationHref || href === clearanceHref);
}

export function useNavItemsAlertCount(items: NavAlertItem[]) {
  const reconciliation = useOutstandingJournalCount("reconciliation", hasHref(items, reconciliationHref));
  const clearance = useOutstandingJournalCount("clearance", hasHref(items, clearanceHref));
  return reconciliation + clearance;
}

export function useNavAlertLabel(href: string | undefined, count: number) {
  const { t } = useTranslation();
  if (count <= 0) return "";
  if (href === reconciliationHref) return t("accounting.journalReconciliation.pendingAlert", { count });
  if (href === clearanceHref) return t("accounting.journalClearance.pendingAlert", { count });
  return "";
}

export function useNavItemsAlertLabel(items: NavAlertItem[], count: number) {
  const { t } = useTranslation();
  return count > 0 && (hasHref(items, reconciliationHref) || hasHref(items, clearanceHref))
    ? t("accounting.pendingTasksAlert", { count }) : "";
}
