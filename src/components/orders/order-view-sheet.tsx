"use client";

import { useMemo } from "react";

import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
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
import { formatAddressLine } from "@/lib/customers/display";
import { formatAuditDate } from "@/lib/audit/display";
import { getContainerLabel } from "@/lib/invoices/display";
import {
  formatOrderCommentSummary,
  formatOrderDate,
  formatOrderId,
  getOrderBranchLabel,
  getOrderCompletedLabel,
  getRouteAssignmentLabel,
  getRouteName,
} from "@/lib/orders/display";
import { cloneRoutes } from "@/lib/routes/mock-data";
import type { Order } from "@/lib/orders/types";
import { getOrderPartyAddress } from "@/lib/orders/types";
import { getBranchBadgeClass } from "@/lib/trucks/display";

type OrderViewSheetProps = {
  order: Order | null;
  orders: Order[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
};

function PartyCard({ title, party }: { title: string; party: Order["sender"] }) {
  const orderAddress = getOrderPartyAddress(party);

  return (
    <RecordViewSheetSection title={title} padding="relaxed">
      <p className="text-sm font-medium">{party.name}</p>
      {party.documentId ? <p className="mt-1 text-xs text-muted-foreground">Doc: {party.documentId}</p> : null}
      {party.email ? <p className="text-xs text-muted-foreground">{party.email}</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">
        {party.phones.length > 0
          ? party.phones.map((phone) => (phone.label ? `${phone.label}: ${phone.number}` : phone.number)).join(" · ")
          : "—"}
      </p>

      <div className="mt-4 space-y-1">
        <p className="text-xs font-medium text-primary">Order address</p>
        {orderAddress ? (
          <p className="text-sm leading-relaxed">{formatAddressLine(orderAddress)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>

      {party.addresses.length > 1 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">All addresses</p>
          {party.addresses.map((address) => (
            <p
              key={address.id}
              className={`text-xs leading-relaxed ${address.id === party.orderAddressId ? "font-medium text-foreground" : "text-muted-foreground"}`}
            >
              {formatAddressLine(address)}
            </p>
          ))}
        </div>
      ) : null}
    </RecordViewSheetSection>
  );
}

export function OrderViewSheet({ order, orders, open, onOpenChange, onEdit, onDelete }: OrderViewSheetProps) {
  const routes = useMemo(() => cloneRoutes(), []);

  if (!order) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={`Order ${formatOrderId(order)}`}
          description={formatOrderDate(order.date)}
          meta={
            <>
              <Badge className={getBranchBadgeClass(order.branch)}>{getOrderBranchLabel(order.branch)}</Badge>
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
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Order">
            <RecordViewSheetDetailRow label="Pickup #" value={formatOrderId(order)} />
            <RecordViewSheetDetailRow label="Pickup ID" value={order.orderId} />
            <RecordViewSheetDetailRow label="Purpose" value={order.purpose || "—"} />
            <RecordViewSheetDetailRow label="Sector" value={order.sectorName || "—"} />
            <RecordViewSheetDetailRow label="Date" value={formatOrderDate(order.date)} />
            <RecordViewSheetDetailRow label="Container" value={getContainerLabel(order.containerId)} />
            <RecordViewSheetDetailRow label="Pending" value={getOrderBranchLabel(order.pending)} />
            <RecordViewSheetDetailRow label="Branch" value={getOrderBranchLabel(order.branch)} />
            <RecordViewSheetDetailRow label="Route" value={getRouteName(order.routeId, routes)} />
            <RecordViewSheetDetailRow label="Route assignment" value={getRouteAssignmentLabel(order.routeAssignmentId)} />
            <RecordViewSheetDetailRow label="Status" value={getOrderCompletedLabel(order.completed)} />
            <RecordViewSheetDetailRow label="Date created" value={formatAuditDate(order.createdAt)} />
            <RecordViewSheetDetailRow label="User created" value={order.createdBy} />
            <RecordViewSheetDetailRow label="Date modified" value={formatAuditDate(order.updatedAt)} />
          </RecordViewSheetSection>

          <PartyCard title="Sender" party={order.sender} />

          <SenderOrderHistorySection sender={order.sender} orders={orders} currentOrderId={order.orderId} />

          {order.receivers.length > 0 ? (
            <div className="space-y-5">
              {order.receivers.map((receiver, index) => (
                <PartyCard key={receiver.id} title={`Receiver ${index + 1}`} party={receiver} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 px-5 py-8 text-center text-sm text-muted-foreground">
              No receivers on this order.
            </div>
          )}

          <RecordViewSheetSection title={`Comments (${order.comments.length})`} padding="relaxed">
            {order.comments.length > 0 ? (
              <ul className="space-y-2">
                {order.comments.map((comment) => (
                  <li
                    key={comment.id}
                    className="rounded-lg border border-border/60 bg-background/60 px-4 py-3 text-sm leading-relaxed"
                  >
                    {formatOrderCommentSummary(comment)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No comments.</p>
            )}
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit order" onEdit={() => onEdit(order)} onDelete={() => onDelete(order)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
