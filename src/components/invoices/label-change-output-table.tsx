"use client";

import { useTranslation } from "@/lib/i18n";
import type { LabelUpdateResult } from "@/lib/labels/types";
import { cn } from "@/lib/utils";

export type LabelChangeOutputRow = {
  id: string;
  barcode: string;
  invoiceNumber: string;
  /** Current / resulting container label when known. */
  container?: string;
  previousStatus?: string;
  newStatus?: string;
  previousContainer?: string;
  newContainer?: string;
  previousRoute?: string;
  newRoute?: string;
  createdBy?: string;
  message: string;
  success: boolean;
  occurredAt: string;
};

type LabelChangeOutputTableProps = {
  rows: LabelChangeOutputRow[];
  /** When set, render the panel with this empty copy instead of hiding the table. */
  emptyMessage?: string;
  className?: string;
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

function OutputValue({ value }: { value?: string | number }) {
  const { t } = useTranslation();
  if (value === undefined || value === "") {
    return <span className="text-muted-foreground">{t("common.empty.dash")}</span>;
  }
  return <span>{value}</span>;
}

/** Map scanner API results into the shared Barcode Changes row shape. */
export function labelUpdateResultToChangeRow(result: LabelUpdateResult): LabelChangeOutputRow {
  return {
    id: result.id,
    barcode: result.barcode,
    invoiceNumber: result.invoiceNumber ?? "",
    container: result.container ?? result.newContainer,
    previousStatus: result.previousStatus,
    newStatus: result.newStatus,
    previousContainer: result.previousContainer,
    newContainer: result.newContainer,
    previousRoute: result.previousRoute,
    newRoute: result.newRoute,
    createdBy: result.createdBy,
    message: result.message,
    success: result.success,
    occurredAt: result.dateTime,
  };
}

export function LabelChangeOutputTable({
  rows,
  emptyMessage,
  className,
}: LabelChangeOutputTableProps) {
  const { locale, t } = useTranslation();

  if (rows.length === 0 && !emptyMessage) return null;

  return (
    <div
      data-testid="label-change-output"
      className={cn(
        "flex max-h-[min(20rem,45%)] min-h-[8rem] shrink-0 flex-col overflow-hidden rounded-xl border",
        className,
      )}
    >
      <div className="border-b bg-muted/10 px-3 py-2">
        <h2 className="text-sm font-medium">{t("labels.staging.output.title")}</h2>
        <p className="text-xs text-muted-foreground">{t("labels.staging.output.description")}</p>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-muted/50 text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.barcode")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.invoice")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.container")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.prevStatus")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.newStatus")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.prevContainer")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.newContainer")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.prevRoute")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.newRoute")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.updatedAt")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.updatedBy")}</th>
                <th className="px-3 py-2 font-medium">{t("labels.staging.output.columns.message")}</th>
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
                    <OutputValue value={row.container} />
                  </td>
                  <td className="px-3 py-2">
                    <OutputValue value={row.previousStatus} />
                  </td>
                  <td className="px-3 py-2">
                    <OutputValue value={row.newStatus} />
                  </td>
                  <td className="px-3 py-2">
                    <OutputValue value={row.previousContainer} />
                  </td>
                  <td className="px-3 py-2">
                    <OutputValue value={row.newContainer} />
                  </td>
                  <td className="px-3 py-2">
                    <OutputValue value={row.previousRoute} />
                  </td>
                  <td className="px-3 py-2">
                    <OutputValue value={row.newRoute} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatOccurredAt(row.occurredAt, locale)}
                  </td>
                  <td className="px-3 py-2">
                    <OutputValue value={row.createdBy} />
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
