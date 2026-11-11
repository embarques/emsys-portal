"use client";

import Link from "next/link";
import { useEffect } from "react";
import { FormSection } from "@/components/forms/form-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { useCurrentIncomeStatement } from "@/lib/accounting/daily-income/hooks";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";

type LoanCloseoutPanelProps = {
  branchId?: number;
  branchCode?: string;
  branchName?: string;
  date: string;
  onDateChange?: (date: string) => void;
  onReadyChange?: (ready: boolean) => void;
};

function useLoanCloseoutStatus(branchId: number, date: string, onReadyChange?: (ready: boolean) => void) {
  const query = useCurrentIncomeStatement(branchId);
  const ready = Boolean(query.data?.status === "OPEN" && branchId && date && !query.isError);
  useEffect(() => { onReadyChange?.(ready); }, [ready, onReadyChange]);
  return query;
}

/** Keeps the open-closeout requirement without showing the card (transaction entry already set up the closeout). */
export function LoanCloseoutGate({ branchId = 0, date, onReadyChange }: Pick<LoanCloseoutPanelProps, "branchId" | "date" | "onReadyChange">) {
  useLoanCloseoutStatus(branchId, date, onReadyChange);
  return null;
}

export function LoanCloseoutPanel({ branchId = 0, branchCode = "", branchName = "", date, onDateChange, onReadyChange }: LoanCloseoutPanelProps) {
  const { t } = useTranslation();
  const query = useLoanCloseoutStatus(branchId, date, onReadyChange);
  const statement = query.data;
  return <FormSection variant="card" title={t("accounting.dailyIncome.title")}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium">{branchName || branchCode || t("common.empty.dash")}</p>
        {query.isError ? <p role="alert" className="text-sm text-destructive">{normalizeApiError(query.error).message}</p>
          : query.isFetching ? <p role="status" className="text-sm text-muted-foreground">{t("accounting.financialActivity.loading")}</p>
          : statement ? <div className="flex flex-wrap items-center gap-2"><Badge variant={statement.status === "OPEN" ? "default" : "secondary"}>{t(statement.status === "OPEN" ? "accounting.dailyIncome.status.open" : "accounting.dailyIncome.status.closed")}</Badge><span className="text-sm text-muted-foreground">{statement.businessDate || statement.date}</span></div>
          : <p className="text-sm text-muted-foreground">{t("accounting.financialActivity.noCurrentCloseout")}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!branchId || query.isFetching} onClick={() => void query.refetch()}>{t("accounting.financialActivity.refresh")}</Button>
        <Button asChild variant="ghost" size="sm"><Link href="/accounting/daily-income">{t("accounting.dailyIncome.title")}</Link></Button>
      </div>
    </div>
    {onDateChange ? <div className="space-y-2"><Label htmlFor="loan-occurrence-date">{t("accounting.financialActivity.occurrenceDate")}</Label><DateInput id="loan-occurrence-date" value={date} onChange={event => onDateChange(event.target.value)} /></div> : null}
  </FormSection>;
}
