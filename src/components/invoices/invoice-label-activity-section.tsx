"use client";

import { useMemo } from "react";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  buildInvoiceLabelActivityTimeline,
  formatActivityAction,
  formatLabelTimestamp,
  truncateBarcode,
} from "@/lib/labels/display";
import { useLabelsStore } from "@/lib/labels/use-labels-store";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InvoiceLabelActivitySectionProps = {
  invoice: Invoice;
};

export function InvoiceLabelActivitySection({ invoice }: InvoiceLabelActivitySectionProps) {
  const { t } = useTranslation();
  const { labels, activityLog } = useLabelsStore();

  const timeline = useMemo(
    () => buildInvoiceLabelActivityTimeline(invoice, activityLog, labels),
    [activityLog, invoice, labels],
  );

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        {t("labels.activity.section.title", { count: timeline.length })}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{t("labels.activity.section.description")}</p>

      {timeline.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("labels.activity.section.empty")}</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">{t("labels.activity.columns.dateCreated")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.activity.columns.userCreated")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.activity.columns.dateModified")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.activity.columns.barcode")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.activity.columns.action")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.activity.columns.description")}</th>
              </tr>
            </thead>
            <tbody>
              {[...timeline].reverse().map((entry) => (
                <tr
                  key={entry.id}
                  className={cn(
                    "border-b last:border-0",
                    entry.success ? "bg-emerald-500/5" : "bg-destructive/5",
                  )}
                >
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    {formatLabelTimestamp(entry.timestamp)}
                  </td>
                  <td className="px-3 py-2 text-xs">{entry.performedBy}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">—</td>
                  <td className="px-3 py-2 font-mono text-xs" title={entry.barcode}>
                    {entry.barcode === "—" ? "—" : truncateBarcode(entry.barcode)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {formatActivityAction(entry.action, t)}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">{entry.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
