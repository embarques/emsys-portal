"use client";

import { useMemo } from "react";

import { RecordViewSheetDetailRow, RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import { formatLabelTimestamp } from "@/lib/labels/display";
import { buildInvoicePackageTrackerEntries } from "@/lib/invoices/package-tracker";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InvoicePackageTrackerSectionProps = {
  invoice: Invoice;
};

export function InvoicePackageTrackerSection({ invoice }: InvoicePackageTrackerSectionProps) {
  const { t } = useTranslation();

  const timeline = useMemo(() => buildInvoicePackageTrackerEntries(invoice), [invoice]);

  const sortedTimeline = [...timeline].reverse();

  return (
    <RecordViewSheetSection
      title={t("invoices.view.packageTracker.title", { count: timeline.length })}
    >
      {sortedTimeline.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("invoices.view.packageTracker.empty")}</p>
      ) : (
        <ul className="divide-y-4 divide-border/60">
          {sortedTimeline.map((entry) => (
            <li
              key={entry.id}
              className={cn("border-l-2", entry.success ? "border-l-emerald-500/40" : "border-l-destructive/40")}
            >
              <RecordViewSheetDetailRow
                label={t("invoices.view.packageTracker.fields.dateTime")}
                value={formatLabelTimestamp(entry.timestamp)}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.packageTracker.fields.createdBy")}
                value={entry.performedBy}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.packageTracker.fields.description")}
                value={entry.description}
              />
            </li>
          ))}
        </ul>
      )}
    </RecordViewSheetSection>
  );
}
