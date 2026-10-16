"use client";

import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useOpenIncomeStatements, useSetIncomeStatementStatus } from "@/lib/accounting/daily-income/hooks";
import type { DailyIncomeStatement } from "@/lib/accounting/daily-income/types";
import { formatAccountingDate } from "@/lib/accounting/display";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";

export function OpenCloseoutsPanel({ branchId, date, onReview }: {
  branchId: number; date: string; onReview: (date: string) => void;
}) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const [expanded, setExpanded] = useState(true);
  const [page, setPage] = useState(1);
  const [closing, setClosing] = useState<DailyIncomeStatement | null>(null);
  const query = useOpenIncomeStatements(branchId, page);
  const mutation = useSetIncomeStatementStatus();
  if (!branchId) return null;
  const items = query.data?.items ?? [];
  async function close() {
    if (!closing) return;
    try {
      await mutation.mutateAsync({ statement: closing, open: false });
      setClosing(null);
      setPage(1);
      feedback.notifySuccess(t("accounting.dailyIncome.toasts.statementClosed"));
    } catch (error) { feedback.notifyError(normalizeApiError(error).message); }
  }
  return <section className="mb-6 overflow-hidden rounded-xl border bg-card">
    <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
      <span className="text-sm font-semibold">{t("accounting.dailyIncome.navigation.openTitle")}</span>
      <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
    </button>
    {expanded ? <div className="border-t px-4 py-3">
      <p className="mb-3 text-sm text-muted-foreground">{t("accounting.dailyIncome.navigation.openDescription")}</p>
      {query.isPending ? <p role="status" className="text-sm">{t("accounting.dailyIncome.navigation.loading")}</p> : query.isError ? <div className="space-y-2 text-sm text-destructive"><p>{normalizeApiError(query.error).message}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("accounting.dailyIncome.navigation.retry")}</Button></div> : items.length === 0 ? <p className="text-sm text-muted-foreground">{t("accounting.dailyIncome.navigation.empty")}</p> : <div className="divide-y">
        {items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
          <div><p className="text-sm font-medium">{formatAccountingDate(item.date)}</p><p className="text-xs text-muted-foreground">#{String(item.id).padStart(5, "0")} · {t(item.date === date ? "accounting.dailyIncome.navigation.viewing" : "accounting.dailyIncome.status.open")}</p></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={item.date === date} onClick={() => onReview(item.date)}>{t("accounting.dailyIncome.navigation.review")}</Button><Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => setClosing(item)}><Lock className="size-3.5" />{t("accounting.dailyIncome.actions.closeDay")}</Button></div>
        </div>)}
      </div>}
      {page > 1 || query.data?.hasMore ? <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" disabled={page === 1 || query.isFetching} onClick={() => setPage(page - 1)}>{t("accounting.dailyIncome.navigation.previous")}</Button><Button size="sm" variant="ghost" disabled={!query.data?.hasMore || query.isFetching} onClick={() => setPage(page + 1)}>{t("accounting.dailyIncome.navigation.next")}</Button></div> : null}
    </div> : null}
    <Dialog open={!!closing} onOpenChange={(open) => { if (!open && !mutation.isPending) setClosing(null); }}><DialogContent><DialogHeader><DialogTitle>{t("accounting.dailyIncome.actions.closeDay")}</DialogTitle><DialogDescription>{t("accounting.dailyIncome.navigation.confirm", { date: closing ? formatAccountingDate(closing.date) : "", id: closing?.id ?? "" })}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={mutation.isPending} onClick={() => setClosing(null)}>{t("common.actions.cancel")}</Button><Button disabled={mutation.isPending} onClick={() => void close()}>{t("accounting.dailyIncome.actions.closeDay")}</Button></DialogFooter></DialogContent></Dialog>
  </section>;
}
