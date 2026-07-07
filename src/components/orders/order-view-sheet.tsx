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
import { formatTableColumnLabel } from "@/lib/table/column-labels";
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
import type { Customer } from "@/lib/customers/types";
import { getAllAddresses } from "@/lib/customers/utils/address-utils";
import type { Order } from "@/lib/orders/types";
import { getBranchBadgeClass } from "@/lib/vehicles/display";

type OrderViewSheetProps = {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
};

function CustomerCard({ title, customer }: { title: string; customer: Customer }) {
  const phones = getOrderedRecordPhones(customer.phones);
  const addresses = getAllAddresses(customer);

  return (
    <>
      <RecordViewSheetSection title={title} padding="relaxed">
        <p className="text-sm font-medium">{customer.name}</p>
        {customer.IDNumber ? (
          <p className="text-xs text-muted-foreground">IDNumber: {customer.IDNumber}</p>
        ) : null}
        {customer.email ? <p className="text-xs text-muted-foreground">{customer.email}</p> : null}
      </RecordViewSheetSection>

      {addresses.length > 0 ? (
        <RecordViewSheetSection title={`${title} address`} icon={MapPin}>
          {addresses.map((address, index) => (
            <AddressActionRow
              key={`${title}-address-${index}`}
              label={index === 0 ? "Primary address" : `Additional address ${index}`}
              address={address}
            />
          ))}
        </RecordViewSheetSection>
      ) : null}

      {phones.length > 0 ? (
        <RecordViewSheetSection title={`${title} phones`} icon={PhoneIcon}>
          {phones.map((phone, index) => (
            <PhoneActionRow
              key={`${title}-phone-${index}`}
              label={
                phone.isPrimary
                  ? `${formatRecordPhoneTypeLabel(phone.type)} (primary)`
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
  const routeLookup = useRouteLookup();

  if (!order) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={order.sender.name.trim() || `Pickup ${formatOrderId(order)}`}
          description={`Pickup ${formatOrderId(order)}`}
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
                {getOrderCompletedLabel(order.completed)}
              </Badge>
            </div>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Pickup">
            <RecordViewSheetDetailRow label={formatTableColumnLabel("date")} value={formatOrderDate(order.date)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("completed")} value={getOrderCompletedLabel(order.completed)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("purpose")} value={order.purpose} />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("sector.id")}
              value={order.sector ? String(order.sector.id) : undefined}
            />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("sector.name")} value={order.sector?.name} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("employee")} value={formatEmployeeSummary(order.employee)} />
            <RecordViewSheetDetailRow
              label={formatTableColumnLabel("route")}
              value={formatOrderRouteName(order, routeLookup.getByKey(order.routeId))}
            />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("createdBy")} value={formatUserSummary(order.user)} />
          </RecordViewSheetSection>

          <CustomerCard title="sender" customer={order.sender} />

          <SenderOrderHistorySection sender={order.sender} currentOrderId={String(order.id)} />

          {order.receiver ? (
            <CustomerCard title="receiver" customer={order.receiver} />
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 px-5 py-8 text-center text-sm text-muted-foreground">
              No receiver on this pickup.
            </div>
          )}

          {order.comments.length > 0 ? (
            <RecordViewSheetSection title={`comments (${order.comments.length})`} padding="relaxed">
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

          <RecordViewSheetSection title="Summary" padding="relaxed">
            <p className="text-sm text-muted-foreground">{formatCustomerPartySummary(order.sender)}</p>
          </RecordViewSheetSection>

          <RecordViewSheetSection title="System information" icon={Info}>
            <RecordViewSheetDetailRow label="Order ID" value={String(order.id)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.id")} value={String(order.branch.id)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.name")} value={order.branch.name} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.code")} value={order.branch.code} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("createdAt")} value={formatAuditDate(order.createdAt)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("updatedAt")} value={formatAuditDate(order.updatedAt)} />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit pickup" onEdit={() => onEdit(order)} onDelete={() => onDelete(order)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
