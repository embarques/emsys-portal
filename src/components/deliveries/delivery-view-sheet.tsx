"use client";

import { PackageCheck, Printer, Send, ScanBarcode, UserRound } from "lucide-react";

import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { DeliveryActionNotice } from "@/components/deliveries/delivery-action-notice";
import { DeliveryRowBalance } from "@/components/deliveries/delivery-balance-amount";
import { TablePhoneCell } from "@/components/phones/table-phone-cell";
import { Button } from "@/components/ui/button";
import { formatBarcodeDeliveryRoute } from "@/lib/barcodes/display";
import { formatDeliveryAddress, type AssignedDeliveryBarcode } from "@/lib/deliveries/types";
import { useTranslation } from "@/lib/i18n";
type DeliveryViewSheetProps = {
  row: AssignedDeliveryBarcode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDeliver: boolean;
  canPrint: boolean;
  onDeliver: (row: AssignedDeliveryBarcode) => void;
  onPrint: (row: AssignedDeliveryBarcode) => void;
};

export function DeliveryViewSheet({ row, open, onOpenChange, canDeliver, canPrint, onDeliver, onPrint }: DeliveryViewSheetProps) {
  const { t } = useTranslation();

  if (!row) return null;

  const dash = t("common.empty.dash");
  const actionDisabled = !row.invoiceId || !row.delivery?.id;
  const receiverPhones = row.receiver?.phones ?? [];
  const senderPhones = row.sender?.phones ?? [];

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={t("deliveries.view.title")}
          description={t("deliveries.view.description", { barcode: row.number || dash, invoice: row.invoiceNumber || dash })}        />

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
            <RecordViewSheetDetailRow label={t("deliveries.view.route")} value={formatBarcodeDeliveryRoute(row.route, t)} />
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={UserRound} title={t("deliveries.view.sections.receiver")}>
            <RecordViewSheetDetailRow label={t("deliveries.columns.receiverName")} value={row.receiver?.name} />
            <RecordViewSheetDetailRow label={t("deliveries.columns.address")} value={formatDeliveryAddress(row.receiver)} />
            <RecordViewSheetDetailRow label={t("deliveries.view.city")} value={row.receiver?.city} />
            <RecordViewSheetDetailRow label={t("deliveries.columns.province")} value={row.receiver?.province} />
            <RecordViewSheetDetailRow
              label={t("deliveries.columns.phones")}
              value={receiverPhones.length ? <TablePhoneCell phones={receiverPhones} callable /> : null}
            />
          </RecordViewSheetSection>

          <RecordViewSheetSection icon={Send} title={t("deliveries.view.sections.sender")}>
            <RecordViewSheetDetailRow label={t("deliveries.columns.senderName")} value={row.sender?.name} />
            <RecordViewSheetDetailRow
              label={t("deliveries.columns.senderPhones")}
              value={senderPhones.length ? <TablePhoneCell phones={senderPhones} callable /> : null}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        {canDeliver || canPrint ? (
          <div className="shrink-0 border-t border-border bg-card px-6 py-4">
            <div className="flex gap-2">
              {canDeliver ? (
                <Button type="button" className="flex-1" disabled={actionDisabled} onClick={() => onDeliver(row)}>
                  <PackageCheck className="size-4" />{t("deliveries.deliver.action")}
                </Button>
              ) : null}
              {canPrint ? (
                <Button type="button" variant="outline" className={canDeliver ? undefined : "flex-1"} disabled={actionDisabled} onClick={() => onPrint(row)}>
                  <Printer className="size-4" />{t("invoices.printSignatures.action")}
                </Button>
              ) : null}
            </div>
            <DeliveryActionNotice row={row} className="max-w-none" />
          </div>
        ) : null}
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
