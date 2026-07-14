"use client";

import { ScanBarcode } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import {
  formatBarcodeContainer,
  formatBarcodeDelivery,
  formatBarcodeDeliveryRoute,
  formatBarcodeId,
  formatBarcodeScanDate,
  formatBarcodeStatus,
  formatBarcodeTripNumber,
  getBarcodeStatusBadgeClass,
} from "@/lib/barcodes/display";
import { formatAuditDateTime } from "@/lib/audit/display";
import type { Barcode } from "@/lib/barcodes/types";
import { useTranslation } from "@/lib/i18n";

type BarcodeViewSheetProps = {
  barcode: Barcode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (barcode: Barcode) => void;
  onDelete: (barcode: Barcode) => void;
};

export function BarcodeViewSheet({
  barcode,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: BarcodeViewSheetProps) {
  const { t, locale } = useTranslation();

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
              label={t("barcodes.columns.status")}
              value={formatBarcodeStatus(barcode.status, t)}
            />
            <RecordViewSheetDetailRow
              label={t("barcodes.columns.container")}
              value={formatBarcodeContainer(barcode.container, t)}
            />
            <RecordViewSheetDetailRow
              label={t("barcodes.columns.deliveryRoute")}
              value={formatBarcodeDeliveryRoute(barcode.route, t)}
            />
            <RecordViewSheetDetailRow
              label={t("barcodes.columns.tripNumber")}
              value={formatBarcodeTripNumber(barcode.tripNumber, t)}
            />
            <RecordViewSheetDetailRow
              label={t("barcodes.columns.delivery")}
              value={formatBarcodeDelivery(barcode.delivery, t)}
            />
            <RecordViewSheetDetailRow
              label={t("barcodes.columns.scanDate")}
              value={formatBarcodeScanDate(barcode.scanDate, locale)}
            />
            {barcode.status?.prevStatus ? (
              <RecordViewSheetDetailRow
                label={t("barcodes.view.previousStatus")}
                value={formatBarcodeStatus({ name: barcode.status.prevStatus }, t)}
              />
            ) : null}
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("barcodes.view.sections.audit")}>
            <RecordViewSheetDetailRow
              label={t("common.audit.dateCreated")}
              value={barcode.createdAt ? formatAuditDateTime(barcode.createdAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("common.audit.createdBy")}
              value={barcode.createdBy || dash}
            />
            <RecordViewSheetDetailRow
              label={t("common.audit.dateModified")}
              value={barcode.updatedAt ? formatAuditDateTime(barcode.updatedAt) : dash}
            />
            <RecordViewSheetDetailRow
              label={t("common.audit.updatedBy")}
              value={barcode.updatedBy || dash}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("barcodes.actions.edit")}
          deleteLabel={t("common.actions.delete")}
          onEdit={() => onEdit(barcode)}
          onDelete={() => onDelete(barcode)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
