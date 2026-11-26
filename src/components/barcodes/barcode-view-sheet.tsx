"use client";

import Link from "next/link";
import {
  Container as ContainerIcon,
  FilePenLine,
  FileText,
  Info,
  PackageCheck,
  Printer,
  Route as RouteIcon,
  ScanBarcode,
  Tag,
} from "lucide-react";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import {
  TableSelectionActionsMenu,
  TableSelectionActionItem
} from "@/components/app-shell/table-selection-actions-menu";
import {
  RecordViewSheet,
  RecordViewSheetActions,
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
import { changeRequestHref } from "@/lib/change-requests/utils/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  tableSelectionActionMenuStyles,
  tableSelectionActionStyles,
} from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

type BarcodeViewSheetProps = {
  barcode: Barcode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionsDisabled?: boolean;
  canDeliver?: boolean;
  canPrint?: boolean;
  canOpenInvoice?: boolean;
  canChangeStatus?: boolean;
  canTransferContainer?: boolean;
  canAssignRoute?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  deliverDisabled?: boolean;
  printDisabled?: boolean;
  isPrinting?: boolean;
  openInvoiceDisabled?: boolean;
  changeStatusDisabled?: boolean;
  transferContainerDisabled?: boolean;
  assignRouteDisabled?: boolean;
  editDisabled?: boolean;
  deleteDisabled?: boolean;
  onDeliver?: (barcode: Barcode) => void;
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
  canPrint = false,
  canOpenInvoice = false,
  canChangeStatus = false,
  canTransferContainer = false,
  canAssignRoute = false,
  canEdit = false,
  canDelete = false,
  deliverDisabled = false,
  printDisabled = false,
  isPrinting = false,
  openInvoiceDisabled = false,
  changeStatusDisabled = false,
  transferContainerDisabled = false,
  assignRouteDisabled = false,
  editDisabled = false,
  deleteDisabled = false,
  onDeliver,
  onPrint,
  onOpenInvoice,
  onChangeStatus,
  onTransferContainer,
  onAssignRoute,
  onEdit,
  onDelete,
}: BarcodeViewSheetProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();

  if (!barcode) return null;

  const statusName = barcode.status?.name ?? "";
  const dash = t("common.empty.dash");
  const allowRequestChange = hasPermission("canCreateChangeRequest", "change_request");
  const showDeliver = Boolean(canDeliver && onDeliver);
  const showOpenInvoice = Boolean(canOpenInvoice && onOpenInvoice);
  const showChangeStatus = Boolean(canChangeStatus && onChangeStatus);
  const showTransferContainer = Boolean(canTransferContainer && onTransferContainer);
  const showAssignRoute = Boolean(canAssignRoute && onAssignRoute);
  const showPrint = Boolean(canPrint && onPrint);
  const showSecondaryActionsMenu =
    showDeliver ||
    showOpenInvoice ||
    showChangeStatus ||
    showTransferContainer ||
    showAssignRoute ||
    allowRequestChange;
  const showRecordActions = (canEdit && onEdit) || (canDelete && onDelete);
  const showFooter = showPrint || showSecondaryActionsMenu || showRecordActions;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          icon={ScanBarcode}
          eyebrow={t("barcodes.entity")}
          title={barcode.number}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection icon={ScanBarcode} title={t("barcodes.view.sections.details")}>
            <RecordViewSheetDetailRow
              label={t("barcodes.view.barcodeId")}
              value={formatBarcodeId(barcode.id)}
            />
            <RecordViewSheetDetailRow
              label={t("barcodes.columns.status")}
              value={
                statusName ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "whitespace-nowrap rounded-full px-2.5 py-1",
                      getBarcodeStatusBadgeClass(statusName),
                    )}
                  >
                    {formatBarcodeStatus(barcode.status, t)}
                  </Badge>
                ) : (
                  dash
                )
              }
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
          <RecordViewSheetActions
            isDisabled={actionsDisabled}
            editDisabled={editDisabled}
            deleteDisabled={deleteDisabled}
            onEdit={canEdit && onEdit ? () => onEdit(barcode) : undefined}
            onDelete={canDelete && onDelete ? () => onDelete(barcode) : undefined}
            leading={
              <>
                {showPrint ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
                    disabled={actionsDisabled || printDisabled || isPrinting}
                    onClick={() => onPrint?.(barcode)}
                  >
                    <Printer className="size-4" />
                    {t(isPrinting ? "barcodes.print.preparing" : "barcodes.print.action")}
                  </Button>
                ) : null}
                <TableSelectionActionsMenu
                  hidden={!showSecondaryActionsMenu}
                  disabled={actionsDisabled}
                >
                  {showDeliver ? (
                    <TableSelectionActionItem
                      disabled={actionsDisabled || deliverDisabled}
                      onSelect={() => onDeliver?.(barcode)}
                      className={tableSelectionActionMenuStyles.deliver}
                    >
                      <PackageCheck className="size-4" />
                      {t("deliveries.deliver.action")}
                    </TableSelectionActionItem>
                  ) : null}
                  {showOpenInvoice ? (
                    <TableSelectionActionItem
                      disabled={actionsDisabled || openInvoiceDisabled}
                      onSelect={() => onOpenInvoice?.(barcode)}
                      className={tableSelectionActionMenuStyles.view}
                    >
                      <FileText className="size-4" />
                      {t("barcodes.bulk.openInvoice")}
                    </TableSelectionActionItem>
                  ) : null}
                  {showChangeStatus ? (
                    <TableSelectionActionItem
                      disabled={actionsDisabled || changeStatusDisabled}
                      onSelect={() => onChangeStatus?.(barcode)}
                      className={tableSelectionActionMenuStyles.status}
                    >
                      <Tag className="size-4" />
                      {t("barcodes.bulk.changeStatus")}
                    </TableSelectionActionItem>
                  ) : null}
                  {showTransferContainer ? (
                    <TableSelectionActionItem
                      disabled={actionsDisabled || transferContainerDisabled}
                      onSelect={() => onTransferContainer?.(barcode)}
                      className={tableSelectionActionMenuStyles.transfer}
                    >
                      <ContainerIcon className="size-4" />
                      {t("barcodes.bulk.changeContainer")}
                    </TableSelectionActionItem>
                  ) : null}
                  {showAssignRoute ? (
                    <TableSelectionActionItem
                      disabled={actionsDisabled || assignRouteDisabled}
                      onSelect={() => onAssignRoute?.(barcode)}
                      className={tableSelectionActionMenuStyles.assign}
                    >
                      <RouteIcon className="size-4" />
                      {t("barcodes.bulk.assignRoute")}
                    </TableSelectionActionItem>
                  ) : null}
                  {allowRequestChange ? (
                    <TableSelectionActionItem asChild className={tableSelectionActionMenuStyles.request}>
                      <Link
                        href={changeRequestHref(
                          "labels",
                          String(barcode.barcodeId || barcode.id),
                        )}
                      >
                        <FilePenLine className="size-4" />
                        {t("accounting.journalLifecycle.request")}
                      </Link>
                    </TableSelectionActionItem>
                  ) : null}
                </TableSelectionActionsMenu>
              </>
            }
          />
        ) : null}
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}