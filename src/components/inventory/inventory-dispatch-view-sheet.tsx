"use client";

import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { InventoryRecordActions } from "@/components/inventory/inventory-record-actions";
import { InventoryDocumentStatusBadge } from "@/components/inventory/inventory-status-badge";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useTranslation } from "@/lib/i18n";
import { formatInventoryDateTime, getHolderNameById, getItemNameById } from "@/lib/inventory/display";
import type { InventoryItem } from "@/lib/inventory/types";
import { sumLineQuantities, type InventoryDispatch } from "@/lib/inventory/types/documents";
import type { InventoryHolder } from "@/lib/inventory/types/holders";

type InventoryDispatchViewSheetProps = {
  dispatch: InventoryDispatch | null;
  items: InventoryItem[];
  holders: InventoryHolder[];
  employeeName?: (employeeId: string) => string;
  open: boolean;
  isBusy?: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (dispatch: InventoryDispatch) => void;
  onPost?: (dispatch: InventoryDispatch) => void;
  onCancelDraft?: (dispatch: InventoryDispatch) => void;
};

export function InventoryDispatchViewSheet({
  dispatch,
  items,
  holders,
  employeeName = (employeeId) => employeeId,
  open,
  isBusy = false,
  onOpenChange,
  onEdit,
  onPost,
  onCancelDraft,
}: InventoryDispatchViewSheetProps) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  if (!dispatch) return null;
  const isDraft = dispatch.status === "DRAFT";

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={getHolderNameById(dispatch.toHolderId, holders) || t("inventory.references.dispatch")}
          description={t("inventory.references.dispatch")}
        />
        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("inventory.form.sections.header")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.status")} value={<InventoryDocumentStatusBadge status={dispatch.status} />} />
            <RecordViewSheetDetailRow label={t("inventory.form.fields.fromHolder")} value={getHolderNameById(dispatch.fromHolderId, holders) || dash} />
            <RecordViewSheetDetailRow label={t("inventory.form.fields.toHolder")} value={getHolderNameById(dispatch.toHolderId, holders) || dash} />
            <RecordViewSheetDetailRow
              label={t("inventory.form.fields.assigneeEmployee")}
              value={dispatch.assigneeEmployeeId ? employeeName(dispatch.assigneeEmployeeId) : dash}
            />
            <RecordViewSheetDetailRow label={t("inventory.form.fields.dailyRouteId")} value={dispatch.dailyRouteId || dash} />
            <RecordViewSheetDetailRow label={t("inventory.form.fields.dispatchedAt")} value={formatInventoryDateTime(dispatch.dispatchedAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.postedAt")} value={dispatch.postedAt ? formatInventoryDateTime(dispatch.postedAt) : dash} />
            <RecordViewSheetDetailRow label={t("inventory.columns.postedBy")} value={dispatch.postedBy || dash} />
            <RecordViewSheetDetailRow label={t("inventory.form.fields.notes")} value={dispatch.notes || dash} />
          </RecordViewSheetSection>
          <RecordViewSheetSection title={t("inventory.view.lines")}>
            {dispatch.lines.map((line, index) => (
              <RecordViewSheetDetailRow
                key={line.id ?? `${line.itemId}-${index}`}
                label={getItemNameById(line.itemId, items)}
                value={String(line.quantity)}
              />
            ))}
            <RecordViewSheetDetailRow label={t("inventory.columns.totalQuantity")} value={String(sumLineQuantities(dispatch.lines))} />
          </RecordViewSheetSection>
          <RecordViewSheetSection title={t("inventory.view.audit")}>
            <RecordViewSheetDetailRow label={t("inventory.columns.dateCreated")} value={formatAuditDateTime(dispatch.createdAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userCreated")} value={dispatch.createdBy || dash} />
            <RecordViewSheetDetailRow label={t("inventory.columns.dateModified")} value={formatAuditDateTime(dispatch.updatedAt)} />
            <RecordViewSheetDetailRow label={t("inventory.columns.userModified")} value={dispatch.updatedBy || dash} />
          </RecordViewSheetSection>
          {!isDraft ? (
            <p className="px-6 pb-4 text-xs text-muted-foreground">{t("inventory.form.workflow.readOnlyPosted")}</p>
          ) : null}
        </RecordViewSheetBody>
        <InventoryRecordActions
          disabled={isBusy}
          onPost={isDraft && onPost ? () => onPost(dispatch) : undefined}
          onEdit={isDraft && onEdit ? () => onEdit(dispatch) : undefined}
          onCancelDraft={isDraft && onCancelDraft ? () => onCancelDraft(dispatch) : undefined}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
