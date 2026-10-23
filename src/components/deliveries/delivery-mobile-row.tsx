"use client";

import { DeliveryActionNotice } from "@/components/deliveries/delivery-action-notice";

import { PackageCheck, Phone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDeliveryAddress, formatDeliveryPhones, type AssignedDeliveryBarcode } from "@/lib/deliveries/types";
import { useTranslation } from "@/lib/i18n";
import { getBarcodeStatusLabel } from "@/lib/labels/display";

type DeliveryMobileRowProps = {
  row: AssignedDeliveryBarcode;
  canDeliver: boolean;
  canPrint?: boolean;
  onPrint?: (row: AssignedDeliveryBarcode) => void;
  onDeliver: (row: AssignedDeliveryBarcode) => void;
};

export function DeliveryMobileRow({ row, canDeliver, onDeliver, canPrint, onPrint }: DeliveryMobileRowProps) {
  const { t } = useTranslation();
  const address = formatDeliveryAddress(row.receiver);
  const city = row.receiver?.city;
  const phones = formatDeliveryPhones(row.receiver);
  const fields = [
    [t("deliveries.columns.barcode"), row.number],
    [t("deliveries.columns.invoice"), row.invoiceNumber],
    [t("deliveries.columns.name"), row.description],
    [t("deliveries.columns.container"), row.container?.name],
  ].filter(([, value]) => value);

  return (
    <article className="min-w-0 border-b border-border px-4 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 break-words text-base font-semibold leading-6 text-foreground [overflow-wrap:anywhere]">
          {row.receiver?.name || "—"}
        </p>
        {row.status?.name ? <Badge variant="outline" className="shrink-0">{getBarcodeStatusLabel(row.status.name, t)}</Badge> : null}
      </div>
      {address || city ? (
        <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {[address, city].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {phones.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {phones.map((phone) => (
            <a key={phone.dial} href={`tel:${phone.dial}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium">
              <Phone className="size-4" aria-hidden />{phone.label}
            </a>
          ))}
        </div>
      ) : null}
      {fields.length ? (
        <dl className="mt-3 grid min-w-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          {fields.map(([label, value]) => (
            <div className="contents" key={label}>
              <dt className="max-w-40 text-muted-foreground [overflow-wrap:anywhere]">{label}</dt>
              <dd className="min-w-0 [overflow-wrap:anywhere]">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {canDeliver ? (
        <Button type="button" className="mt-3 h-11 w-full" disabled={!row.invoiceId || !row.delivery?.id} onClick={() => onDeliver(row)}>
          <PackageCheck className="size-4" />{t("deliveries.deliver.action")}
        </Button>
      ) : null}
      {canPrint && onPrint ? <Button type="button" variant="outline" className="mt-2 h-11 w-full" disabled={!row.invoiceId || !row.delivery?.id} onClick={() => onPrint(row)}>{t("invoices.printSignatures.action")}</Button> : null}
      {(canDeliver || (canPrint && onPrint)) ? <DeliveryActionNotice row={row} /> : null}
    </article>
  );
}
