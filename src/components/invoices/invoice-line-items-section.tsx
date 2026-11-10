"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RecordViewSheetDetailRow, RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { getBarcodeStatusBadgeClass } from "@/lib/barcodes/display";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import type { InvoiceLineItem } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";

function formatBarcodeScanDate(
  scanDate: string | undefined,
  empty: string,
): string {
  if (!scanDate) return empty;
  const parsed = new Date(scanDate);
  if (Number.isNaN(parsed.getTime())) return empty;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function InvoiceLineItemCard({ item }: { item: InvoiceLineItem }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const barcodes = item.barcodes ?? [];
  const hasBarcodes = barcodes.length > 0;
  const showDescription = Boolean(
    item.description && item.description !== item.itemName,
  );
  const panelId = useId();
  const barcodeToggleLabel = open
    ? t(
        barcodes.length === 1
          ? "invoices.view.lineItems.hideBarcodesCount"
          : "invoices.view.lineItems.hideBarcodesCount_plural",
        { count: barcodes.length },
      )
    : t(
        barcodes.length === 1
          ? "invoices.view.lineItems.showBarcodesCount"
          : "invoices.view.lineItems.showBarcodesCount_plural",
        { count: barcodes.length },
      );

  return (
    <li className="overflow-hidden rounded-lg border border-border/60 bg-background">
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium leading-snug text-foreground">
          {item.itemName}
        </p>
        {showDescription ? (
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {item.description}
          </p>
        ) : null}
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm leading-5">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">
              {t("invoices.form.lineItems.columns.quantity")}
            </dt>
            <dd className="tabular-nums text-foreground">{item.quantity}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">
              {t("invoices.form.lineItems.columns.labels")}
            </dt>
            <dd className="tabular-nums text-foreground">{item.labelCount}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">
              {t("invoices.form.lineItems.columns.unitPrice")}
            </dt>
            <dd className="tabular-nums text-foreground">
              {formatInvoiceMoney(item.unitPrice)}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">
              {t("invoices.form.lineItems.columns.total")}
            </dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {formatInvoiceMoney(item.lineTotal)}
            </dd>
          </div>
        </dl>
        {hasBarcodes ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            {barcodeToggleLabel}
          </button>
        ) : null}
      </div>
      {hasBarcodes && open ? (
        <ul
          id={panelId}
          className="space-y-2 border-t border-border/60 bg-muted/30 px-3 py-2.5"
        >
          {barcodes.map((barcode) => (
            <li
              key={barcode.id}
              className="overflow-hidden rounded-lg border border-border bg-card"
            >
              <RecordViewSheetDetailRow
                label={t("invoices.view.barcodeStatus.fields.barcode")}
                value={<span className="font-mono">{barcode.number}</span>}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.barcodeStatus.fields.status")}
                value={
                  barcode.statusName ? (
                    <TableTagText
                      className={getBarcodeStatusBadgeClass(barcode.statusName)}
                    >
                      {barcode.statusName}
                    </TableTagText>
                  ) : undefined
                }
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.barcodeStatus.fields.container")}
                value={barcode.containerName}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.barcodeStatus.fields.deliveryRoute")}
                value={barcode.deliveryName ?? barcode.routeName}
              />
              <RecordViewSheetDetailRow
                label={t("invoices.view.fields.scanned")}
                value={formatBarcodeScanDate(barcode.scanDate, "")}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function InvoiceLineItemsSection({ lineItems }: { lineItems: readonly InvoiceLineItem[] }) {
  const { t } = useTranslation();
  return (
    <RecordViewSheetSection title={t("invoices.wizard.review.lineItems")} padding="relaxed">
      {lineItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("invoices.wizard.review.noLineItems")}</p>
      ) : (
        <ul className="space-y-2">
          {lineItems.map((item) => <InvoiceLineItemCard key={item.id} item={item} />)}
        </ul>
      )}
    </RecordViewSheetSection>
  );
}
