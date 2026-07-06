"use client";

import { Info, MapPin, Phone as PhoneIcon } from "lucide-react";

import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
import { AddressActionRow } from "@/components/addresses/address-action-row";
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
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { formatRecordPhoneTypeLabel, getOrderedRecordPhones } from "@/lib/phones/phones";
import { formatAuditDate } from "@/lib/audit/display";
import {
  formatCustomerPartySummary,
  formatEmployeeSummary,
  formatOrderDate,
  formatOrderId,
  formatOrderRouteName,
  formatPickupCommentSummary,
  formatUserSummary,
  getOrderBranchLabel,
  getOrderCompletedLabel,
} from "@/lib/orders/display";
import { useRouteLookup } from "@/lib/route-manager/hooks/use-route-manager";
import { coreAddressHasContent, type Customer } from "@/lib/customers/types";
import type { Order } from "@/lib/orders/types";
import { getBranchBadgeClass } from "@/lib/vehicles/display";
import { useTranslation } from "@/lib/i18n";

type OrderViewSheetProps = {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
};

function CustomerCard({
  partyKey,
  partyLabel,
  customer,
}: {
  partyKey: "sender" | "receiver";
  partyLabel: string;
  customer: Customer;
}) {
  const { t } = useTranslation();
  const phones = getOrderedRecordPhones(customer.phones);
  const addresses = customer.addresses.filter(coreAddressHasContent);

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

      {addresses.length > 0 ? (
        <RecordViewSheetSection
          title={t("orders.view.senderAddress", { party: partyLabel })}
          icon={MapPin}
        >
          {addresses.map((address, index) => (
            <AddressActionRow
              key={`${partyKey}-address-${index}`}
              label={
                index === 0
                  ? t("orders.view.primaryAddress")
                  : t("orders.view.additionalAddress", { index })
              }
              address={address}
            />
          ))}
        </RecordViewSheetSection>
      ) : null}

      {phones.length > 0 ? (
        <RecordViewSheetSection
          title={t("orders.view.senderPhones", { party: partyLabel })}
          icon={PhoneIcon}
        >
          {phones.map((phone, index) => (
            <PhoneActionRow
              key={`${partyKey}-phone-${index}`}
              label={
                phone.isPrimary
                  ? t("orders.view.phonePrimary", {
                      type: formatRecordPhoneTypeLabel(phone.type),
                    })
                  : formatRecordPhoneTypeLabel(phone.type)
              }
              number={phone.number}
              displayNumber={phone.displayNumber}
            />
          ))}
        </RecordViewSheetSection>
      ) : null}
    </>
  );
}

export function OrderViewSheet({ order, open, onOpenChange, onEdit, onDelete }: OrderViewSheetProps) {
  const { t } = useTranslation();
  const routeLookup = useRouteLookup();

  if (!order) return null;

  const pickupLabel = t("orders.pickupNamed", { id: formatOrderId(order) });

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={order.sender.name.trim() || pickupLabel}
          description={pickupLabel}
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{formatOrderDate(order.date)}</span>
              <Badge className={getBranchBadgeClass(order.branch.code)}>{getOrderBranchLabel(order.branch)}</Badge>
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
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title={t("orders.view.pickup")}>
            <RecordViewSheetDetailRow label={t("orders.columns.date")} value={formatOrderDate(order.date)} />
            <RecordViewSheetDetailRow
              label={t("orders.columns.completed")}
              value={getOrderCompletedLabel(order.completed, t)}
            />
            <RecordViewSheetDetailRow label={t("orders.columns.purpose")} value={order.purpose} />
            <RecordViewSheetDetailRow
              label={t("orders.columns.sectorId")}
              value={order.sector ? String(order.sector.id) : undefined}
            />
            <RecordViewSheetDetailRow label={t("orders.columns.sectorName")} value={order.sector?.name} />
            <RecordViewSheetDetailRow
              label={t("orders.columns.employee")}
              value={formatEmployeeSummary(order.employee)}
            />
            <RecordViewSheetDetailRow
              label={t("orders.columns.route")}
              value={formatOrderRouteName(order, routeLookup.getByKey(order.routeId))}
            />
            <RecordViewSheetDetailRow
              label={t("orders.columns.createdBy")}
              value={formatUserSummary(order.user)}
            />
          </RecordViewSheetSection>

          <CustomerCard
            partyKey="sender"
            partyLabel={t("orders.columns.sender")}
            customer={order.sender}
          />

          <SenderOrderHistorySection sender={order.sender} currentOrderId={String(order.id)} />

          {order.receiver ? (
            <CustomerCard
              partyKey="receiver"
              partyLabel={t("orders.columns.receiver")}
              customer={order.receiver}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 px-5 py-8 text-center text-sm text-muted-foreground">
              {t("orders.empty.noReceiver")}
            </div>
          )}

          {order.comments.length > 0 ? (
            <RecordViewSheetSection
              title={t("orders.view.commentsCount", { count: order.comments.length })}
              padding="relaxed"
            >
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
            </RecordViewSheetSection>
          ) : null}

          <RecordViewSheetSection title={t("orders.view.summary")} padding="relaxed">
            <p className="text-sm text-muted-foreground">{formatCustomerPartySummary(order.sender)}</p>
          </RecordViewSheetSection>

          <RecordViewSheetSection title={t("orders.view.system")} icon={Info}>
            <RecordViewSheetDetailRow label={t("orders.columns.orderId")} value={String(order.id)} />
            <RecordViewSheetDetailRow label={t("orders.columns.branchId")} value={String(order.branch.id)} />
            <RecordViewSheetDetailRow label={t("orders.columns.branchName")} value={order.branch.name} />
            <RecordViewSheetDetailRow label={t("orders.columns.branchCode")} value={order.branch.code} />
            <RecordViewSheetDetailRow
              label={t("orders.columns.createdAt")}
              value={formatAuditDate(order.createdAt)}
            />
            <RecordViewSheetDetailRow
              label={t("orders.columns.updatedAt")}
              value={formatAuditDate(order.updatedAt)}
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
