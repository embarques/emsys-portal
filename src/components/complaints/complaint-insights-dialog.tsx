"use client";

import { useState } from "react";

import {
  CompactActionDialogContent,
  compactActionDialogFormClassName,
} from "@/components/forms/compact-action-dialog";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { normalizeApiError } from "@/lib/api/axios";
import { complaintCategoryLabel } from "@/lib/complaints/display";
import { useComplaintInsights, type useComplaintPeople } from "@/lib/complaints/hooks/use-complaints";
import type { ComplaintCategory, ComplaintInsightCount } from "@/lib/complaints/types";
import {
  complaintInsightsRangeError,
  complaintReopenRate,
  defaultComplaintInsightsRange,
} from "@/lib/complaints/utils/insights";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type People = ReturnType<typeof useComplaintPeople>;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function CountList({ title, rows, label, empty }: { title: string; rows: ComplaintInsightCount[]; label: (key: string) => string; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {rows.length ? (
        <ol className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate">{label(row.key)}</p>
                <div className="mt-1 h-1.5 rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(row.count / max) * 100}%` }} />
                </div>
              </div>
              <span className="text-right tabular-nums">{row.count}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

export function ComplaintInsightsDialog({
  open,
  onOpenChange,
  categories,
  people,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: readonly ComplaintCategory[];
  people: People;
}) {
  const { t, locale } = useTranslation();
  const [range, setRange] = useState(defaultComplaintInsightsRange);
  const rangeError = complaintInsightsRangeError(range.from, range.to);
  const insights = useComplaintInsights(range.from, range.to, open && !rangeError);
  const data = insights.data;
  const dash = t("common.empty.dash");
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const reopenRate = data ? complaintReopenRate(data.total, data.reopened) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <CompactActionDialogContent className={cn(compactActionDialogFormClassName, "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>{t("complaints.insights.title")}</DialogTitle>
          <DialogDescription>{t("complaints.insights.description")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="complaint-insights-from">{t("complaints.insights.from")}</Label>
              <DateInput
                id="complaint-insights-from"
                value={range.from}
                onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="complaint-insights-to">{t("complaints.insights.to")}</Label>
              <DateInput
                id="complaint-insights-to"
                value={range.to}
                onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
              />
            </div>
          </div>
          {rangeError ? (
            <p role="alert" className="text-sm text-destructive">{t(rangeError)}</p>
          ) : insights.isError ? (
            <p role="alert" className="text-sm text-destructive">{normalizeApiError(insights.error).message}</p>
          ) : insights.isLoading || !data ? (
            <p role="status" className="text-sm text-muted-foreground">{t("complaints.insights.loading")}</p>
          ) : (
            <div className={cn("space-y-5", insights.isFetching && "opacity-70")}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label={t("complaints.insights.total")} value={number.format(data.total)} />
                <Stat
                  label={t("complaints.insights.reopened")}
                  value={reopenRate === null ? number.format(data.reopened) : `${number.format(data.reopened)} (${percent.format(reopenRate)})`}
                />
                <Stat
                  label={t("complaints.insights.averageResolution")}
                  value={
                    data.averageResolutionHours === null
                      ? dash
                      : t("complaints.insights.hours", { hours: number.format(data.averageResolutionHours) })
                  }
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <CountList
                  title={t("complaints.insights.byCategory")}
                  rows={data.categories}
                  label={(key) => complaintCategoryLabel(t, key, categories)}
                  empty={t("complaints.insights.empty")}
                />
                <CountList
                  title={t("complaints.insights.byEmployee")}
                  rows={data.employees}
                  label={(key) => people.employeeName(Number(key)) ?? t("complaints.employeeFallback", { id: key })}
                  empty={t("complaints.insights.empty")}
                />
              </div>
            </div>
          )}
        </div>
      </CompactActionDialogContent>
    </Dialog>
  );
}
