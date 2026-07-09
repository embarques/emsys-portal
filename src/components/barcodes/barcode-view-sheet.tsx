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
  formatBarcodeId,
  formatBarcodeScanDate,
  formatBarcodeStatus,
  getBarcodeStatusBadgeClass,
} from "@/lib/barcodes/display";
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
              label={t("barcodes.columns.scanDate")}
              value={formatBarcodeScanDate(barcode.scanDate, locale)}
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
