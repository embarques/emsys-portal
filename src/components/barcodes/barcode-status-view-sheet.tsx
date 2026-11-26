"use client";

import { Tag } from "lucide-react";

import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { useTranslation } from "@/lib/i18n";
import { isProtectedBarcodeStatusId, type BarcodeStatusOption } from "@/lib/labels/types";

type BarcodeStatusViewSheetProps = {
  status: BarcodeStatusOption | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (status: BarcodeStatusOption) => void;
  onDelete: (status: BarcodeStatusOption) => void;
  deleteDisabled?: boolean;
};

export function BarcodeStatusViewSheet({
  status,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  deleteDisabled = false,
}: BarcodeStatusViewSheetProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");

  if (!status) return null;

  const isProtected = isProtectedBarcodeStatusId(status.id);

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          icon={Tag}
          eyebrow={t("barcodeStatuses.entity")}
          title={status.name}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("barcodeStatuses.view.details")} icon={Tag}>
            <RecordViewSheetDetailRow label={t("common.apiColumns.id")} value={status.id} />
            <RecordViewSheetDetailRow label={t("barcodeStatuses.fields.name")} value={status.name} />
            <RecordViewSheetDetailRow
              label={t("barcodeStatuses.fields.previousStatus")}
              value={status.prevStatus?.trim() || dash}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("barcodeStatuses.view.edit")}
          onEdit={() => onEdit(status)}
          onDelete={isProtected ? undefined : () => onDelete(status)}
          deleteDisabled={deleteDisabled}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
