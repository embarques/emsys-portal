"use client";

import { useMemo } from "react";
import { History } from "lucide-react";

import { RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import {
  CompactTableScroll,
  compactTableCellClassName,
  compactTableCellWrapClassName,
  compactTableClassName,
  compactTableHeadClassName,
  compactTableHeadRowClassName,
  compactTableRowClassName,
} from "@/components/ui/compact-table";
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
  const timeline = useMemo(() => buildInvoiceActivityTimeline(invoice, t), [invoice, t]);
  const sortedTimeline = useMemo(() => [...timeline].reverse(), [timeline]);
  const empty = t("common.empty.dash");

  return (
    <RecordViewSheetSection
      title={t("invoices.view.activity.title", { count: timeline.length })}
      icon={History}
    >
      {sortedTimeline.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("invoices.view.activity.empty")}</p>
      ) : (
        <CompactTableScroll aria-label={t("invoices.view.activity.title", { count: timeline.length })}>
          <table className={compactTableClassName}>
            <thead>
              <tr className={compactTableHeadRowClassName}>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.activity.fields.dateTime")}
                </th>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.activity.fields.createdBy")}
                </th>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.activity.fields.description")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTimeline.map((entry) => {
                const dateTime = formatInvoiceCommentDateTime(entry.timestamp);
                return (
                  <tr key={entry.id} className={compactTableRowClassName}>
                    <td className={compactTableCellClassName}>
                      {isFilled(dateTime) ? dateTime : empty}
                    </td>
                    <td className={compactTableCellClassName}>
                      {isFilled(entry.performedBy) ? entry.performedBy : empty}
                    </td>
                    <td className={compactTableCellWrapClassName}>
                      {isFilled(entry.message) ? entry.message : empty}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CompactTableScroll>
      )}
    </RecordViewSheetSection>
  );
}
