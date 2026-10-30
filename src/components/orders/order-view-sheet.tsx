"use client";

import { Info, MapPin, Phone as PhoneIcon, Receipt } from "lucide-react";

import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
import { AddressActionRow } from "@/components/addresses/address-action-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { getOrderedRecordPhones } from "@/lib/phones/phones";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  formatOrderDateWithWeekday,
  formatOrderId,
  formatOrderRouteName,
  formatPickupCommentSummary,
  formatUserSummary,
  getOrderCompletedLabel,
} from "@/lib/orders/display";
import { useActiveRouteLookup } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { coreAddressHasContent, getCustomerPrimaryCoreAddress, type Customer } from "@/lib/customers/types";
import { getOrderReceivers, type Order } from "@/lib/orders/types";
import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { useTranslation } from "@/lib/i18n";

type OrderViewSheetProps = {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
  /** Omit to hide Create invoice (e.g. no invoice access). */
  onCreateInvoice?: (order: Order) => void;
};

function SenderViewSections({ customer }: { customer: Customer }) {
  const { t } = useTranslation();
  const partyLabel = t("orders.columns.sender");
  const phones = getOrderedRecordPhones(customer.phones);
  const address = getCustomerPrimaryCoreAddress(customer);

  return (
    <>
      <RecordViewSheetSection title={partyLabel} padding="relaxed">
        <p className="text-sm font-medium">{customer.name}</p>
        {customer.IDNumber ? (
          <p className="text-xs text-muted-foreground">
            {t("orders.view.idNumber")}: {customer.IDNumber}
          </p>
        ) : null}
        {customer.email ? <p className="text-xs text-muted-foreground">{customer.email}</p> : null}
      </RecordViewSheetSection>

      {phones.length > 0 ? (
        <RecordViewSheetSection
          title={t("orders.view.senderPhones", { party: partyLabel })}
          icon={PhoneIcon}
        >
          {phones.map((phone, index) => (
            <PhoneActionRow
              key={`sender-phone-${index}`}
              label={
                phone.isPrimary
                  ? t("orders.view.phonePrimary", {
                      type: t(`phones.types.${phone.type}`),
                    })
                  : t(`phones.types.${phone.type}`)
              }
              number={phone.number}
              displayNumber={phone.displayNumber}
            />
          ))}
        </RecordViewSheetSection>
      ) : null}

      {coreAddressHasContent(address) ? (
        <RecordViewSheetSection
          title={t("orders.view.senderAddress", { party: partyLabel })}
          icon={MapPin}
        >
          <AddressActionRow
            label={t("orders.view.primaryAddress")}
            address={address}
          />
        </RecordViewSheetSection>
      ) : null}
    </>
  );
}

export function OrderViewSheet({
  order,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onCreateInvoice,
}: OrderViewSheetProps) {
  const { t, locale } = useTranslation();
  const pickupRouteLookup = useActiveRouteLookup("pickup", 500);

  if (!order) return null;

  const receivers = getOrderReceivers(order);

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={order.sender.name.trim() || t("orders.history.defaultSenderName")}
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {formatOrderDateWithWeekday(order.date, locale)}
              </span>
              <Badge
                variant="outline"
                className={
                  order.completed
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }
              >
                {getOrderCompletedLabel(order.completed, t)}
              </Badge>
            </div>
          }
          actions={
            onCreateInvoice ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onCreateInvoice(order)}>
                <Receipt className="size-4" />
                {t("orders.actions.createInvoice")}
              </Button>
            ) : null
          }
        />

        <RecordViewSheetBody>
          <SenderViewSections customer={order.sender} />

          <RecordViewSheetSection
            title={t("orders.comments.title")}
            padding="relaxed"
          >
            {order.comments.length > 0 ? (
              <ul className="space-y-2">
                {order.comments.map((comment, index) => (
                  <li
                    key={`comment-${index}`}
                    className="rounded-lg border border-border/60 bg-background/60 px-4 py-3 text-sm leading-relaxed"
                  >
                    {formatPickupCommentSummary(comment)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("orders.empty.noComments")}</p>
            )}
          </RecordViewSheetSection>

          <RecordViewSheetSection
            title={
              receivers.length > 1
                ? t("orders.view.receiversCount", { count: receivers.length })
                : t("orders.columns.receiver")
            }
            padding="relaxed"
          >
            {receivers.length > 0 ? (
              <ul className="space-y-2">
                {receivers.map((receiver, index) => (
                  <li key={`${receiver.id}-${index}`}>
                    <CustomerContactSummary customer={receiver} addressIndex={0} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("orders.empty.noReceiver")}</p>
            )}
          </RecordViewSheetSection>

          <SenderOrderHistorySection
            sender={order.sender}
            currentOrderId={String(order.id)}
            variant="view"
          />

          <RecordViewSheetSection title={t("orders.view.system")} icon={Info}>
            <RecordViewSheetDetailRow
              label={t("orders.columns.route")}
              value={formatOrderRouteName(order, pickupRouteLookup.getByKey(order.routeId), t)}
            />
            <RecordViewSheetDetailRow
              label={t("orders.view.pickupId")}
              value={formatOrderId(order)}
            />
            <RecordViewSheetDetailRow label={t("orders.columns.branchId")} value={String(order.branch.id)} />
            <RecordViewSheetDetailRow label={t("orders.columns.branchName")} value={order.branch.name} />
            <RecordViewSheetDetailRow label={t("orders.columns.branchCode")} value={order.branch.code} />
            <RecordViewSheetDetailRow
              label={t("orders.columns.createdAt")}
              value={formatAuditDateTime(order.createdAt)}
            />
            <RecordViewSheetDetailRow
              label={t("orders.columns.createdBy")}
              value={formatUserSummary(order.createdBy)}
            />
            <RecordViewSheetDetailRow
              label={t("orders.columns.updatedAt")}
              value={formatAuditDateTime(order.updatedAt)}
            />
            <RecordViewSheetDetailRow
              label={t("common.audit.updatedBy")}
              value={formatUserSummary(order.updatedBy)}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions
          editLabel={t("orders.actions.editPickup")}
          onEdit={() => onEdit(order)}
          onDelete={() => onDelete(order)}
        />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
