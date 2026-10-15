"use client";

import { useMemo } from "react";

import { RecordViewList, RecordViewListItem } from "@/components/app-shell/record-view-list";

import { TableTagText } from "@/components/app-shell/table-tag-text";
import { RecordViewSheetDetailRow, RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import { getBarcodeStatusBadgeClass } from "@/lib/barcodes/display";
import { resolveInvoiceBarcodeStatusRows } from "@/lib/invoices/barcode-status";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";

type InvoiceBarcodeStatusSectionProps = {
  invoice: Invoice;
};

export function InvoiceBarcodeStatusSection({ invoice }: InvoiceBarcodeStatusSectionProps) {
  const { t } = useTranslation();
  const rows = useMemo(() => resolveInvoiceBarcodeStatusRows(invoice), [invoice]);

  return (
    <RecordViewSheetSection
      title={t("invoices.view.barcodeStatus.title", { count: rows.length })}
    >
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("invoices.view.barcodeStatus.empty")}</p>
      ) : (
        <RecordViewList className="bg-muted/20 p-3">
          {rows.map((row) => (
            <RecordViewListItem key={row.id}>
              <RecordViewSheetDetailRow
                label={t("invoices.view.barcodeStatus.fields.invoiceNumber")}
                value={row.invoiceNumber}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.barcodeStatus.fields.barcode")}
                value={row.barcode}
              />
              {row.status && row.status !== "—" ? (
                <RecordViewSheetDetailRow
                  label={t("invoices.view.barcodeStatus.fields.status")}
                  value={
                    <TableTagText className={getBarcodeStatusBadgeClass(row.status)}>
                      {row.status}
                    </TableTagText>
                  }
                />
              ) : null}
              <RecordViewSheetDetailRow
                label={t("invoices.view.barcodeStatus.fields.container")}
                value={row.container}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.barcodeStatus.fields.quantity")}
                value={String(row.quantity)}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.barcodeStatus.fields.labels")}
                value={String(row.labels)}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.barcodeStatus.fields.deliveryRoute")}
                value={row.deliveryRoute}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.barcodeStatus.fields.description")}
                value={row.description}
              />
            </RecordViewListItem>
          ))}
        </RecordViewList>
      )}
    </RecordViewSheetSection>
  );
}
