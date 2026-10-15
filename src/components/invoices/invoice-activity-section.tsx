"use client";

import { useMemo } from "react";

import { RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import { buildInvoiceActivityTimeline } from "@/lib/invoices/activity";
import { formatInvoiceCommentDateTime } from "@/lib/invoices/display";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";

type InvoiceActivitySectionProps = {
  invoice: Invoice;
};

function isFilled(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && trimmed !== "—" && trimmed !== "-";
}

export function InvoiceActivitySection({ invoice }: InvoiceActivitySectionProps) {
  const { t } = useTranslation();
  const timeline = useMemo(() => buildInvoiceActivityTimeline(invoice), [invoice]);
  const sortedTimeline = useMemo(() => [...timeline].reverse(), [timeline]);
  const empty = t("common.empty.dash");

  return (
    <RecordViewSheetSection
      title={t("invoices.view.activity.title", { count: timeline.length })}
    >
      {sortedTimeline.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("invoices.view.activity.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  {t("invoices.view.activity.fields.dateTime")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  {t("invoices.view.activity.fields.createdBy")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("invoices.view.activity.fields.description")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTimeline.map((entry) => {
                const dateTime = formatInvoiceCommentDateTime(entry.timestamp);
                return (
                  <tr key={entry.id} className="border-b last:border-b-0 even:bg-muted/25">
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">
                      {isFilled(dateTime) ? dateTime : empty}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-foreground">
                      {isFilled(entry.performedBy) ? entry.performedBy : empty}
                    </td>
                    <td className="min-w-[10rem] px-3 py-2 leading-snug text-foreground [overflow-wrap:anywhere]">
                      {isFilled(entry.message) ? entry.message : empty}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </RecordViewSheetSection>
  );
}
