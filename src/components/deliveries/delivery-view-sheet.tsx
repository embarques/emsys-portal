"use client";

import { MapPin, PackageCheck, Phone as PhoneIcon, Printer, ScanBarcode, Send, UserRound } from "lucide-react";

import { TableSelectionActionsMenu } from "@/components/app-shell/table-selection-actions-menu";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { AddressActionRow } from "@/components/addresses/address-action-row";
import { DeliveryActionNotice } from "@/components/deliveries/delivery-action-notice";
import { DeliveryRowBalance } from "@/components/deliveries/delivery-balance-amount";
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { formatBarcodeDeliveryRoute } from "@/lib/barcodes/display";
import {
  toDeliveryReceiverCoreAddress,
  toDeliveryRecordPhones,
  type AssignedDeliveryBarcode,
} from "@/lib/deliveries/types";
import { getOrderedRecordPhones } from "@/lib/phones/phones";
import { useTranslation } from "@/lib/i18n";
import { tableSelectionActionMenuStyles, tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

type DeliveryViewSheetProps = {
  row: AssignedDeliveryBarcode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDeliver: boolean;
  canPrint: boolean;
  onDeliver: (row: AssignedDeliveryBarcode) => void;
  onPrint: (row: AssignedDeliveryBarcode) => void;
};

export function DeliveryViewSheet({
  row,
  open,
  onOpenChange,
  canDeliver,
  canPrint,
  onDeliver,
  onPrint,
}: DeliveryViewSheetProps) {
  const { t } = useTranslation();

  if (!row) return null;

  const dash = t("common.empty.dash");
  const actionDisabled = !row.invoiceId || !row.delivery?.id;
  const receiverPhones = getOrderedRecordPhones(toDeliveryRecordPhones(row.receiver?.phones));
  const senderPhones = getOrderedRecordPhones(toDeliveryRecordPhones(row.sender?.phones));
  const receiverAddress = toDeliveryReceiverCoreAddress(row.receiver);
  const showFooter = canDeliver || canPrint;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          icon={PackageCheck}
          eyebrow={t("deliveries.entity")}
          title={t("deliveries.view.title")}
          description={t("deliveries.view.description", {
            barcode: row.number || dash,
            invoice: row.invoiceNumber || dash,
          })}
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection icon={ScanBarcode} title={t("deliveries.view.sections.merchandise")}>
            <RecordViewSheetDetailRow label={t("deliveries.columns.barcode")} value={row.number} />
            <RecordViewSheetDetailRow label={t("deliveries.columns.invoice")} value={row.invoiceNumber} />
            <RecordViewSheetDetailRow
              label={t("deliveries.columns.invoiceBalance")}
              value={row.invoiceBalance != null ? <DeliveryRowBalance row={row} /> : null}
            />
            <RecordViewSheetDetailRow label={t("deliveries.columns.name")} value={row.description} />
            <RecordViewSheetDetailRow label={t("deliveries.columns.container")} value={row.container?.name} />
            <RecordViewSheetDetailRow
              label={t("deliveries.view.route")}
              value={formatBarcodeDeliveryRoute(row.route, t)}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={UserRound} title={t("deliveries.view.sections.receiver")}>
            <RecordViewSheetDetailRow
              label={t("deliveries.columns.receiverName")}
              value={row.receiver?.name || dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={PhoneIcon} title={t("deliveries.columns.phones")}>
            {receiverPhones.length === 0 ? (
              <RecordViewSheetDetailRow label={t("deliveries.columns.phones")} value={dash} />
            ) : (
              receiverPhones.map((phone, index) => (
                <PhoneActionRow
                  key={`receiver-phone-${index}`}
                  label={t(`phones.types.${phone.type}`)}
                  number={phone.number}
                  displayNumber={phone.displayNumber}
                  isPrimary={phone.isPrimary}
                />
              ))
            )}
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={MapPin} title={t("deliveries.columns.address")}>
            {receiverAddress ? (
              <AddressActionRow label="" address={receiverAddress} isPrimary />
            ) : (
              <RecordViewSheetDetailRow label={t("deliveries.columns.address")} value={dash} />
            )}
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={Send} title={t("deliveries.view.sections.sender")}>
            <RecordViewSheetDetailRow
              label={t("deliveries.columns.senderName")}
              value={row.sender?.name || dash}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={PhoneIcon} title={t("deliveries.columns.senderPhones")}>
            {senderPhones.length === 0 ? (
              <RecordViewSheetDetailRow label={t("deliveries.columns.senderPhones")} value={dash} />
            ) : (
              senderPhones.map((phone, index) => (
                <PhoneActionRow
                  key={`sender-phone-${index}`}
                  label={t(`phones.types.${phone.type}`)}
                  number={phone.number}
                  displayNumber={phone.displayNumber}
                  isPrimary={phone.isPrimary}
                />
              ))
            )}
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        {showFooter ? (
          <RecordViewSheetActions
            leading={
              <>
                <TableSelectionActionsMenu hidden={!canDeliver}>
                  <DropdownMenuItem
                    disabled={actionDisabled}
                    onSelect={() => onDeliver(row)}
                    className={tableSelectionActionMenuStyles.deliver}
                  >
                    <PackageCheck className="size-4" />
                    {t("deliveries.deliver.action")}
                  </DropdownMenuItem>
                </TableSelectionActionsMenu>
                {canPrint ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!row.invoiceId}
                    onClick={() => onPrint(row)}
                    className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
                  >
                    <Printer className="size-4" />
                    {t("invoices.printSignatures.action")}
                  </Button>
                ) : null}
              </>
            }
          >
            {!row.invoiceId || !row.delivery?.id ? (
              <DeliveryActionNotice row={row} className="max-w-none" />
            ) : null}
          </RecordViewSheetActions>
        ) : null}
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}