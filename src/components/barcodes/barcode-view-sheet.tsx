"use client";

import { Info, ScanBarcode } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import {
  formatBarcodeContainer,
  formatBarcodeDeliveryRoute,
  formatBarcodeId,
  formatBarcodeStatus,
  getBarcodeStatusBadgeClass,
} from "@/lib/barcodes/display";
import { formatAuditDateTime } from "@/lib/audit/display";
import type { Barcode } from "@/lib/barcodes/types";
import { useTranslation } from "@/lib/i18n";

type BarcodeViewSheetProps = {
  barcode: Barcode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BarcodeViewSheet({ barcode, open, onOpenChange }: BarcodeViewSheetProps) {
  const { t } = useTranslation();

  if (!barcode) return null;

  const statusName = barcode.status?.name ?? "";
  const dash = t("common.empty.dash");

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={barcode.number}
          meta={
            statusName ? (
              <Badge variant="outline" className={getBarcodeStatusBadgeClass(statusName)}>
                {formatBarcodeStatus(barcode.status, t)}
              </Badge>
            ) : null
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection icon={ScanBarcode} title={t("barcodes.view.sections.details")}>
            <RecordViewSheetDetailRow
              label={t("barcodes.view.barcodeId")}
              value={formatBarcodeId(barcode.id)}
            />
            <RecordViewSheetDetailRow
              label={t("barcodes.columns.invoice")}
              value={barcode.invoiceNumber?.trim() || dash}
            />
            <RecordViewSheetDetailRow
              label={t("barcodes.columns.description")}
              value={barcode.description?.trim() || dash}
            />
            <RecordViewSheetDetailRow
              label={t("barcodes.columns.status")}
              value={formatBarcodeStatus(barcode.status, t)}
            />
            <RecordViewSheetDetailRow
              label={t("barcodes.columns.container")}
              value={formatBarcodeContainer(barcode.container, t)}
            />
            <RecordViewSheetDetailRow
              label={t("barcodes.columns.route")}
              value={formatBarcodeDeliveryRoute(barcode.route, t)}
            />
            <div
              role="note"
              className="mx-3 mb-3 mt-3 flex items-start gap-2.5 rounded-lg border border-border/80 bg-muted/40 px-3 py-2.5"
            >
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium leading-snug text-foreground">
                  {t("barcodes.view.manageViaInvoiceTitle")}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("barcodes.view.manageViaInvoice")}
                </p>
              </div>
            </div>
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("barcodes.view.sections.audit")}>
            <RecordViewSheetDetailRow
              label={t("common.audit.createdAt")}
              value={formatAuditDateTime(barcode.createdAt ?? "") || dash}
            />
            <RecordViewSheetDetailRow
              label={t("common.audit.createdBy")}
              value={barcode.createdBy?.trim() || dash}
            />
            <RecordViewSheetDetailRow
              label={t("common.audit.updatedAt")}
              value={formatAuditDateTime(barcode.updatedAt ?? "") || dash}
            />
            <RecordViewSheetDetailRow
              label={t("common.audit.updatedBy")}
              value={barcode.updatedBy?.trim() || dash}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
