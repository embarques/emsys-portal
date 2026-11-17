"use client";

import { useEffect, useState } from "react";
import {
  Container as ContainerIcon,
  FileText,
  Info,
  PackageCheck,
  Pencil,
  Printer,
  Route as RouteIcon,
  ScanBarcode,
  Tag,
  Trash2,
} from "lucide-react";

import { RequestChangeButton } from "@/components/change-requests/request-change-button";
import {
  TableSelectionActionDivider,
  TableSelectionExpandableActionGroup,
} from "@/components/app-shell/table-selection-action-group";
import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

type BarcodeViewSheetProps = {
  barcode: Barcode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionsDisabled?: boolean;
  canDeliver?: boolean;
  canPrintInvoice?: boolean;
  canPrint?: boolean;
  canOpenInvoice?: boolean;
  canChangeStatus?: boolean;
  canTransferContainer?: boolean;
  canAssignRoute?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  deliverDisabled?: boolean;
  printInvoiceDisabled?: boolean;
  printDisabled?: boolean;
  isPrinting?: boolean;
  openInvoiceDisabled?: boolean;
  changeStatusDisabled?: boolean;
  transferContainerDisabled?: boolean;
  assignRouteDisabled?: boolean;
  editDisabled?: boolean;
  deleteDisabled?: boolean;
  onDeliver?: (barcode: Barcode) => void;
  onPrintInvoice?: (barcode: Barcode) => void;
  onPrint?: (barcode: Barcode) => void;
  onOpenInvoice?: (barcode: Barcode) => void;
  onChangeStatus?: (barcode: Barcode) => void;
  onTransferContainer?: (barcode: Barcode) => void;
  onAssignRoute?: (barcode: Barcode) => void;
  onEdit?: (barcode: Barcode) => void;
  onDelete?: (barcode: Barcode) => void;
};

export function BarcodeViewSheet({
  barcode,
  open,
  onOpenChange,
  actionsDisabled = false,
  canDeliver = false,
  canPrintInvoice = false,
  canPrint = false,
  canOpenInvoice = false,
  canChangeStatus = false,
  canTransferContainer = false,
  canAssignRoute = false,
  canEdit = false,
  canDelete = false,
  deliverDisabled = false,
  printInvoiceDisabled = false,
  printDisabled = false,
  isPrinting = false,
  openInvoiceDisabled = false,
  changeStatusDisabled = false,
  transferContainerDisabled = false,
  assignRouteDisabled = false,
  editDisabled = false,
  deleteDisabled = false,
  onDeliver,
  onPrintInvoice,
  onPrint,
  onOpenInvoice,
  onChangeStatus,
  onTransferContainer,
  onAssignRoute,
  onEdit,
  onDelete,
}: BarcodeViewSheetProps) {
  const { t } = useTranslation();
  const [assignmentExpanded, setAssignmentExpanded] = useState(false);

  useEffect(() => {
    if (!open) setAssignmentExpanded(false);
  }, [open]);

  if (!barcode) return null;

  const statusName = barcode.status?.name ?? "";
  const dash = t("common.empty.dash");
  const showHeaderOps = Boolean(
    (canPrintInvoice && onPrintInvoice) ||
      (canPrint && onPrint) ||
      (canOpenInvoice && onOpenInvoice),
  );
  const showDeliver = Boolean(canDeliver && onDeliver);
  const showAssignment =
    (canChangeStatus && onChangeStatus) ||
    (canTransferContainer && onTransferContainer) ||
    (canAssignRoute && onAssignRoute);
  const showRecordActions = (canEdit && onEdit) || (canDelete && onDelete);
  const showFooter = showDeliver || showAssignment || showRecordActions;

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
          actions={
            showHeaderOps ? (
              <>
                {canPrintInvoice && onPrintInvoice ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="whitespace-nowrap"
                    disabled={actionsDisabled || printInvoiceDisabled}
                    onClick={() => onPrintInvoice(barcode)}
                  >
                    <Printer className="size-4" />
                    {t("invoices.printSignatures.action")}
                  </Button>
                ) : null}
                {canPrint && onPrint ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
                    disabled={actionsDisabled || printDisabled || isPrinting}
                    onClick={() => onPrint(barcode)}
                  >
                    <Printer className="size-4" />
                    {t(isPrinting ? "barcodes.print.preparing" : "barcodes.print.action")}
                  </Button>
                ) : null}
                {canOpenInvoice && onOpenInvoice ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn("whitespace-nowrap", tableSelectionActionStyles.view)}
                    disabled={actionsDisabled || openInvoiceDisabled}
                    onClick={() => onOpenInvoice(barcode)}
                  >
                    <FileText className="size-4" />
                    {t("barcodes.bulk.openInvoice")}
                  </Button>
                ) : null}
              </>
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

          <RecordViewSheetSection title={t("barcodes.view.sections.audit")} icon={Info}>
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

        {showFooter ? (
          <div className="shrink-0 border-t border-border bg-card px-6 py-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {showDeliver ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="whitespace-nowrap"
                    disabled={actionsDisabled || deliverDisabled}
                    onClick={() => onDeliver?.(barcode)}
                  >
                    <PackageCheck className="size-4" />
                    {t("deliveries.deliver.action")}
                  </Button>
                  {showAssignment || showRecordActions ? <TableSelectionActionDivider /> : null}
                </>
              ) : null}

              {showAssignment ? (
                <TableSelectionExpandableActionGroup
                  label={t("barcodes.actions.manageAssignment")}
                  icon={Tag}
                  expanded={assignmentExpanded}
                  onExpandedChange={setAssignmentExpanded}
                  disabled={actionsDisabled}
                  aria-label={t("barcodes.actions.assignmentGroup")}
                >
                  {canChangeStatus && onChangeStatus ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionsDisabled || changeStatusDisabled}
                      onClick={() => onChangeStatus(barcode)}
                    >
                      <Tag className="size-4" />
                      {t("barcodes.bulk.changeStatus")}
                    </Button>
                  ) : null}
                  {canTransferContainer && onTransferContainer ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionsDisabled || transferContainerDisabled}
                      onClick={() => onTransferContainer(barcode)}
                    >
                      <ContainerIcon className="size-4" />
                      {t("barcodes.bulk.changeContainer")}
                    </Button>
                  ) : null}
                  {canAssignRoute && onAssignRoute ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionsDisabled || assignRouteDisabled}
                      onClick={() => onAssignRoute(barcode)}
                    >
                      <RouteIcon className="size-4" />
                      {t("barcodes.bulk.assignRoute")}
                    </Button>
                  ) : null}
                </TableSelectionExpandableActionGroup>
              ) : null}

              <RequestChangeButton
                resourceType="labels"
                resourceId={String(barcode.barcodeId || barcode.id)}
                size="sm"
              />

              {showRecordActions ? <TableSelectionActionDivider /> : null}

              {canEdit && onEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actionsDisabled || editDisabled}
                  onClick={() => onEdit(barcode)}
                  className={cn("whitespace-nowrap", tableSelectionActionStyles.edit)}
                >
                  <Pencil className="size-4" />
                  {t("common.actions.edit")}
                </Button>
              ) : null}
              {canDelete && onDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={actionsDisabled || deleteDisabled}
                  onClick={() => onDelete(barcode)}
                  className={cn("whitespace-nowrap", tableSelectionActionStyles.delete)}
                >
                  <Trash2 className="size-4" />
                  {t("common.actions.delete")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <RequestChangeButton
            resourceType="labels"
            resourceId={String(barcode.barcodeId || barcode.id)}
            inSheet
          />
        )}
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
