"use client";

import { useMemo } from "react";

import { RecordViewList, RecordViewListItem } from "@/components/app-shell/record-view-list";

import { RecordViewSheetDetailRow, RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import { buildInvoiceActivityTimeline } from "@/lib/invoices/activity";
import { formatInvoiceCommentDateTime } from "@/lib/invoices/display";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InvoiceActivitySectionProps = {
  invoice: Invoice;
};

export function InvoiceActivitySection({ invoice }: InvoiceActivitySectionProps) {
  const { t } = useTranslation();
  const timeline = useMemo(() => buildInvoiceActivityTimeline(invoice), [invoice]);
  const sortedTimeline = [...timeline].reverse();

  return (
    <RecordViewSheetSection
      title={t("invoices.view.activity.title", { count: timeline.length })}
    >
      {sortedTimeline.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("invoices.view.activity.empty")}</p>
      ) : (
        <RecordViewList className="bg-muted/20 p-3">
          {sortedTimeline.map((entry) => (
            <RecordViewListItem
              key={entry.id}
              className={cn("border-l-2", entry.success ? "border-l-emerald-500/40" : "border-l-destructive/40")}
            >
              <RecordViewSheetDetailRow
                label={t("invoices.view.activity.fields.dateTime")}
                value={formatInvoiceCommentDateTime(entry.timestamp)}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.activity.fields.createdBy")}
                value={entry.performedBy}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.activity.fields.description")}
                value={entry.message}
              />
            </RecordViewListItem>
          ))}
        </RecordViewList>
      )}
    </RecordViewSheetSection>
  );
}
