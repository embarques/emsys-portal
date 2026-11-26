"use client";

import { PackageCheck, Printer, ScanBarcode, Send, UserRound, type LucideIcon } from "lucide-react";

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
import { AddressActionRow } from "@/components/addresses/address-action-row";
import { DeliveryActionNotice } from "@/components/deliveries/delivery-action-notice";
import { DeliveryRowBalance } from "@/components/deliveries/delivery-balance-amount";
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { Button } from "@/components/ui/button";

import { formatBarcodeDeliveryRoute } from "@/lib/barcodes/display";
import {
  toDeliveryReceiverCoreAddress,
  toDeliveryRecordPhones,
  type AssignedDeliveryBarcode,
  type DeliveryReceiver,
  type DeliverySender,
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

function DeliveryPartySection({
  title,
  icon,
  name,
  phones,
  address,
}: {
  title: string;
  icon: LucideIcon;
  name: string;
  phones: DeliveryReceiver["phones"] | DeliverySender["phones"];
  address?: DeliveryReceiver | null;
}) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const trimmedName = name.trim();
  const orderedPhones = getOrderedRecordPhones(toDeliveryRecordPhones(phones));
  const coreAddress = address ? toDeliveryReceiverCoreAddress(address) : null;
  const showAddress = address !== undefined;

  if (!trimmedName && orderedPhones.length === 0 && !coreAddress) return null;

  return (
    <RecordViewSheetSection icon={icon} title={title}>
      <RecordViewSheetDetailRow
        label={t("deliveries.view.fields.name")}
        value={trimmedName || dash}
      />
      {showAddress ? (
        coreAddress ? (
          <AddressActionRow label={t("deliveries.view.fields.address")} address={coreAddress} />
        ) : (
          <RecordViewSheetDetailRow label={t("deliveries.view.fields.address")} value={dash} />
        )
      ) : null}
      {orderedPhones.length === 0 ? (
        <RecordViewSheetDetailRow label={t("deliveries.view.fields.phones")} value={dash} />
      ) : (
        orderedPhones.map((phone, index) => (
          <PhoneActionRow
            key={`${title}-phone-${index}`}
            label={t(`phones.types.${phone.type}`)}
            number={phone.number}
            displayNumber={phone.displayNumber}
            isPrimary={phone.isPrimary}
          />
        ))
      )}
    </RecordViewSheetSection>
  );
}

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

          <DeliveryPartySection
            title={t("deliveries.view.sections.receiver")}
            icon={UserRound}
            name={row.receiver?.name ?? ""}
            phones={row.receiver?.phones ?? []}
            address={row.receiver}
          />

          <DeliveryPartySection
            title={t("deliveries.view.sections.sender")}
            icon={Send}
            name={row.sender?.name ?? ""}
            phones={row.sender?.phones ?? []}
          />
        </RecordViewSheetBody>

        {showFooter ? (
          <RecordViewSheetActions
            leading={
              <>
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
                <TableSelectionActionsMenu hidden={!canDeliver}>
                  <TableSelectionActionItem
                    disabled={actionDisabled}
                    onSelect={() => onDeliver(row)}
                    className={tableSelectionActionMenuStyles.deliver}
                  >
                    <PackageCheck className="size-4" />
                    {t("deliveries.deliver.action")}
                  </TableSelectionActionItem>
                </TableSelectionActionsMenu>
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
