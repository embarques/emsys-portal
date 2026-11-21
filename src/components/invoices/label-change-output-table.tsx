"use client";

import {
  CompactTableScroll,
  compactTableCellClassName,
  compactTableCellWrapClassName,
  compactTableClassName,
  compactTableHeadClassName,
  compactTableHeadRowClassName,
  compactTableRowClassName,
  compactTableShellClassName,
} from "@/components/ui/compact-table";
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
        "max-h-[min(20rem,45%)] min-h-[8rem] shrink-0",
        compactTableShellClassName,
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
        <CompactTableScroll
          aria-label={t("labels.staging.output.title")}
          className="min-h-0 flex-1"
        >
          <table className={compactTableClassName}>
            <thead>
              <tr className={compactTableHeadRowClassName}>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.barcode")}</th>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.invoice")}</th>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.container")}</th>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.prevStatus")}</th>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.newStatus")}</th>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.prevContainer")}</th>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.newContainer")}</th>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.prevRoute")}</th>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.newRoute")}</th>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.updatedAt")}</th>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.updatedBy")}</th>
                <th className={compactTableHeadClassName}>{t("labels.staging.output.columns.message")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={compactTableRowClassName}>
                  <td className={cn(compactTableCellClassName, "font-mono")}>{row.barcode}</td>
                  <td className={compactTableCellClassName}>
                    <OutputValue value={row.invoiceNumber} />
                  </td>
                  <td className={compactTableCellClassName}>
                    <OutputValue value={row.container} />
                  </td>
                  <td className={compactTableCellClassName}>
                    <OutputValue value={row.previousStatus} />
                  </td>
                  <td className={compactTableCellClassName}>
                    <OutputValue value={row.newStatus} />
                  </td>
                  <td className={compactTableCellClassName}>
                    <OutputValue value={row.previousContainer} />
                  </td>
                  <td className={compactTableCellClassName}>
                    <OutputValue value={row.newContainer} />
                  </td>
                  <td className={compactTableCellClassName}>
                    <OutputValue value={row.previousRoute} />
                  </td>
                  <td className={compactTableCellClassName}>
                    <OutputValue value={row.newRoute} />
                  </td>
                  <td className={compactTableCellClassName}>
                    {formatOccurredAt(row.occurredAt, locale)}
                  </td>
                  <td className={compactTableCellClassName}>
                    <OutputValue value={row.createdBy} />
                  </td>
                  <td
                    className={cn(
                      compactTableCellWrapClassName,
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
        </CompactTableScroll>
      )}
    </div>
  );
}
