"use client";
import {useAuth} from "@/lib/auth/hooks/use-auth";
import {useAccountingQueryEnabled} from "@/lib/accounting/daily-income/hooks";
import {fetchOutstandingJournalCount} from "@/lib/accounting/daily-income/reconciliation-api";
import {useWorkspaceQuery} from "@/lib/query/use-workspace-query";
import {queryKeys} from "@/lib/query/query-keys";
import {useTranslation} from "@/lib/i18n";

const pendingHref = "/accounting/pending-financial-activity";
type NavAlertItem = {href?: string; children?: Array<{href?: string}>};
function hasPending(items: NavAlertItem[]) {
 return items.some(item => item.href === pendingHref || item.children?.some(child => child.href === pendingHref));
}
export function useOutstandingJournalCount() {
 const {companyId, hasPermission} = useAuth();
 const ready = useAccountingQueryEnabled();
 const query = useWorkspaceQuery({
  queryKey: [...queryKeys.accounting.all, "outstanding-journal-count", companyId],
  queryFn: ({signal}) => fetchOutstandingJournalCount(signal),
  enabled: ready && hasPermission("canViewJournal","journal"), staleTime: 30_000,
 });
 return query.data ?? 0;
}
export function useNavAlertCount(href?: string) {
 const count = useOutstandingJournalCount();
 return href === pendingHref ? count : 0;
}
export function useNavItemsAlertCount(items: NavAlertItem[]) {
 const count = useOutstandingJournalCount();
 return hasPending(items) ? count : 0;
}
export function useNavAlertLabel(href: string | undefined, count: number) {
 const {t} = useTranslation();
 return count > 0 && href === pendingHref ? t("accounting.journalReconciliation.pendingAlert", {count}) : "";
}
export function useNavItemsAlertLabel(items: NavAlertItem[], count: number) {
 const {t} = useTranslation();
 return count > 0 && hasPending(items) ? t("accounting.journalReconciliation.pendingAlert", {count}) : "";
}
