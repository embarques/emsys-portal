"use client";

import { useMemo } from "react";
import { ScanBarcode } from "lucide-react";

import { TableTagText } from "@/components/app-shell/table-tag-text";
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
import { cn } from "@/lib/utils";
import { getBarcodeStatusBadgeClass } from "@/lib/barcodes/display";
import { resolveInvoiceBarcodeStatusRows } from "@/lib/invoices/barcode-status";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";

type InvoiceBarcodeStatusSectionProps = {
  invoice: Invoice;
};

function isFilled(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && trimmed !== "—" && trimmed !== "-";
}

export function InvoiceBarcodeStatusSection({ invoice }: InvoiceBarcodeStatusSectionProps) {
  const { t } = useTranslation();
  const rows = useMemo(() => resolveInvoiceBarcodeStatusRows(invoice), [invoice]);
  const empty = t("common.empty.dash");

  return (
    <RecordViewSheetSection
      title={t("invoices.view.barcodeStatus.title", { count: rows.length })}
      icon={ScanBarcode}
    >
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("invoices.view.barcodeStatus.empty")}</p>
      ) : (
        <CompactTableScroll aria-label={t("invoices.view.barcodeStatus.title", { count: rows.length })}>
          <table className={compactTableClassName}>
            <thead>
              <tr className={compactTableHeadRowClassName}>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.barcodeStatus.fields.barcode")}
                </th>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.barcodeStatus.fields.status")}
                </th>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.barcodeStatus.fields.container")}
                </th>
                <th className={cn(compactTableHeadClassName, "text-right")}>
                  {t("invoices.view.barcodeStatus.fields.quantity")}
                </th>
                <th className={cn(compactTableHeadClassName, "text-right")}>
                  {t("invoices.view.barcodeStatus.fields.labels")}
                </th>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.barcodeStatus.fields.deliveryRoute")}
                </th>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.barcodeStatus.fields.description")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={compactTableRowClassName}>
                  <td className={cn(compactTableCellClassName, "font-mono font-medium")}>
                    {row.barcode}
                  </td>
                  <td className={compactTableCellClassName}>
                    {isFilled(row.status) ? (
                      <TableTagText className={getBarcodeStatusBadgeClass(row.status)}>
                        {row.status}
                      </TableTagText>
                    ) : (
                      <span className="text-muted-foreground">{empty}</span>
                    )}
                  </td>
                  <td className={compactTableCellClassName}>
                    {isFilled(row.container) ? row.container : empty}
                  </td>
                  <td className={cn(compactTableCellClassName, "text-right tabular-nums")}>
                    {row.quantity}
                  </td>
                  <td className={cn(compactTableCellClassName, "text-right tabular-nums")}>
                    {row.labels}
                  </td>
                  <td className={compactTableCellClassName}>
                    {isFilled(row.deliveryRoute) ? row.deliveryRoute : empty}
                  </td>
                  <td className={cn(compactTableCellWrapClassName, "min-w-[8rem]")}>
                    {isFilled(row.description) ? row.description : empty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CompactTableScroll>
      )}
    </RecordViewSheetSection>
  );
}
