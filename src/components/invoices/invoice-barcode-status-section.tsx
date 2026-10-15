"use client";

import { useMemo } from "react";

import { TableTagText } from "@/components/app-shell/table-tag-text";
import { RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
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
    >
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("invoices.view.barcodeStatus.empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-muted-foreground">
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  {t("invoices.view.barcodeStatus.fields.barcode")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  {t("invoices.view.barcodeStatus.fields.status")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  {t("invoices.view.barcodeStatus.fields.container")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {t("invoices.view.barcodeStatus.fields.quantity")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {t("invoices.view.barcodeStatus.fields.labels")}
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-medium">
                  {t("invoices.view.barcodeStatus.fields.deliveryRoute")}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t("invoices.view.barcodeStatus.fields.description")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0 even:bg-muted/25">
                  <td className="whitespace-nowrap px-3 py-2 font-mono font-medium text-foreground">
                    {row.barcode}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {isFilled(row.status) ? (
                      <TableTagText className={getBarcodeStatusBadgeClass(row.status)}>
                        {row.status}
                      </TableTagText>
                    ) : (
                      <span className="text-muted-foreground">{empty}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground">
                    {isFilled(row.container) ? row.container : empty}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
                    {row.quantity}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
                    {row.labels}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-foreground">
                    {isFilled(row.deliveryRoute) ? row.deliveryRoute : empty}
                  </td>
                  <td className="min-w-[8rem] px-3 py-2 leading-snug text-foreground [overflow-wrap:anywhere]">
                    {isFilled(row.description) ? row.description : empty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </RecordViewSheetSection>
  );
}
