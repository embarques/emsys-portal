"use client";

import { useMemo } from "react";
import { Package } from "lucide-react";

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
import { formatLabelTimestamp } from "@/lib/labels/display";
import { buildInvoicePackageTrackerEntries } from "@/lib/invoices/package-tracker";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";

type InvoicePackageTrackerSectionProps = {
  invoice: Invoice;
};

function isFilled(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && trimmed !== "—" && trimmed !== "-";
}

export function InvoicePackageTrackerSection({ invoice }: InvoicePackageTrackerSectionProps) {
  const { t } = useTranslation();
  const timeline = useMemo(() => buildInvoicePackageTrackerEntries(invoice, t), [invoice, t]);
  const sortedTimeline = useMemo(() => [...timeline].reverse(), [timeline]);
  const empty = t("common.empty.dash");

  return (
    <RecordViewSheetSection
      title={t("invoices.view.packageTracker.title", { count: timeline.length })}
      icon={Package}
    >
      {sortedTimeline.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("invoices.view.packageTracker.empty")}</p>
      ) : (
        <CompactTableScroll aria-label={t("invoices.view.packageTracker.title", { count: timeline.length })}>
          <table className={compactTableClassName}>
            <thead>
              <tr className={compactTableHeadRowClassName}>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.packageTracker.fields.dateTime")}
                </th>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.packageTracker.fields.createdBy")}
                </th>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.packageTracker.fields.description")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTimeline.map((entry) => {
                const dateTime = formatLabelTimestamp(entry.timestamp);
                return (
                  <tr key={entry.id} className={compactTableRowClassName}>
                    <td className={compactTableCellClassName}>
                      {isFilled(dateTime) ? dateTime : empty}
                    </td>
                    <td className={compactTableCellClassName}>
                      {isFilled(entry.performedBy) ? entry.performedBy : empty}
                    </td>
                    <td className={compactTableCellWrapClassName}>
                      {isFilled(entry.description) ? entry.description : empty}
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
