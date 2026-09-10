"use client";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type LabelChangeOutputRow = {
  id: string;
  barcode: string;
  invoiceNumber: string;
  previousValue: string;
  newValue: string;
  message: string;
  success: boolean;
  occurredAt: string;
};

type LabelChangeOutputTableProps = {
  rows: LabelChangeOutputRow[];
};

function formatOccurredAt(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === "es" ? "es" : "en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function OutputValue({ value }: { value: string }) {
  const { t } = useTranslation();
  const trimmed = value.trim();
  if (!trimmed) {
    return <span className="text-muted-foreground">{t("common.empty.dash")}</span>;
  }
  return <span>{trimmed}</span>;
}

export function LabelChangeOutputTable({ rows }: LabelChangeOutputTableProps) {
  const { locale, t } = useTranslation();

  if (rows.length === 0) return null;

  return (
    <div
      data-testid="label-change-output"
      className="flex max-h-[min(16rem,40%)] min-h-[8rem] shrink-0 flex-col overflow-hidden rounded-xl border"
    >
      <div className="border-b bg-muted/10 px-3 py-2">
        <h2 className="text-sm font-medium">{t("labels.staging.output.title")}</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted/50 text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.barcode")}</th>
              <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.invoice")}</th>
              <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.previousValue")}</th>
              <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.newValue")}</th>
              <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.message")}</th>
              <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.dateTime")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{row.barcode}</td>
                <td className="px-3 py-2">
                  <OutputValue value={row.invoiceNumber} />
                </td>
                <td className="px-3 py-2">
                  <OutputValue value={row.previousValue} />
                </td>
                <td className="px-3 py-2">
                  <OutputValue value={row.newValue} />
                </td>
                <td
                  className={cn(
                    "px-3 py-2",
                    row.success
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive",
                  )}
                >
                  {row.message}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatOccurredAt(row.occurredAt, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
