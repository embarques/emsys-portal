"use client";

import { useMemo } from "react";
import { ScanBarcode } from "lucide-react";

import { TableTagText } from "@/components/app-shell/table-tag-text";
import { InvoiceViewCollapsibleSection } from "@/components/invoices/invoice-view-collapsible-section";
import { InvoiceViewField, InvoiceViewListItem } from "@/components/invoices/invoice-view-field";
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
    <InvoiceViewCollapsibleSection
      title={t("invoices.view.barcodeStatus.title", { count: rows.length })}
      description={t("invoices.view.barcodeStatus.description")}
      icon={ScanBarcode}
      count={rows.length}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("invoices.view.barcodeStatus.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <InvoiceViewListItem key={row.id}>
              <InvoiceViewField
                label={t("invoices.view.barcodeStatus.fields.invoiceNumber")}
                value={row.invoiceNumber}
              />
              <InvoiceViewField
                label={t("invoices.view.barcodeStatus.fields.barcode")}
                value={row.barcode}
                mono
              />
              {row.status && row.status !== "—" ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("invoices.view.barcodeStatus.fields.status")}
                  </span>
                  <TableTagText className={getBarcodeStatusBadgeClass(row.status)}>
                    {row.status}
                  </TableTagText>
                </div>
              ) : null}
              <InvoiceViewField
                label={t("invoices.view.barcodeStatus.fields.quantity")}
                value={String(row.quantity)}
              />
              <InvoiceViewField
                label={t("invoices.view.barcodeStatus.fields.labels")}
                value={String(row.labels)}
              />
              <InvoiceViewField
                label={t("invoices.view.barcodeStatus.fields.container")}
                value={row.container}
              />
              <InvoiceViewField
                label={t("invoices.view.barcodeStatus.fields.deliveryRoute")}
                value={row.deliveryRoute}
              />
              <InvoiceViewField
                label={t("invoices.view.barcodeStatus.fields.description")}
                value={row.description}
              />
            </InvoiceViewListItem>
          ))}
        </ul>
      )}
    </InvoiceViewCollapsibleSection>
  );
}
