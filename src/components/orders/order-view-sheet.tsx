"use client";

import { Pencil, Trash2 } from "lucide-react";

import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatAddressLine } from "@/lib/customers/display";
import { formatAuditDate } from "@/lib/audit/display";
import { getContainerLabel } from "@/lib/invoices/display";
import {
  formatOrderCommentSummary,
  formatOrderDate,
  getOrderBranchLabel,
  getOrderCompletedLabel,
  getRouteAssignmentLabel,
  getRouteName,
  truncateOrderId,
} from "@/lib/orders/display";
import { cloneRoutes } from "@/lib/routes/mock-data";
import type { Order } from "@/lib/orders/types";
import { getOrderPartyAddress } from "@/lib/orders/types";
import { getBranchBadgeClass } from "@/lib/trucks/display";
import { useMemo } from "react";

type OrderViewSheetProps = {
  order: Order | null;
  orders: Order[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium">{value}</span>
    </div>
  );
}

function PartyCard({ title, party }: { title: string; party: Order["sender"] }) {
  const orderAddress = getOrderPartyAddress(party);

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-2 text-sm font-medium">{party.name}</p>
      {party.documentId ? <p className="text-xs text-muted-foreground">Doc: {party.documentId}</p> : null}
      {party.email ? <p className="text-xs text-muted-foreground">{party.email}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">
        {party.phones.length > 0
          ? party.phones.map((phone) => (phone.label ? `${phone.label}: ${phone.number}` : phone.number)).join(" · ")
          : "—"}
      </p>

      <div className="mt-3 space-y-2">
        <p className="text-xs font-medium text-primary">Order address</p>
        {orderAddress ? (
          <p className="text-sm">{formatAddressLine(orderAddress)}</p>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>

      {party.addresses.length > 1 ? (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">All addresses</p>
          {party.addresses.map((address) => (
            <p
              key={address.id}
              className={`text-xs ${address.id === party.orderAddressId ? "font-medium text-foreground" : "text-muted-foreground"}`}
            >
              {formatAddressLine(address)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OrderViewSheet({ order, orders, open, onOpenChange, onEdit, onDelete }: OrderViewSheetProps) {
  const routes = useMemo(() => cloneRoutes(), []);

  if (!order) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-10">
          <SheetTitle>Order {truncateOrderId(order.orderId)}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span>{formatOrderDate(order.date)}</span>
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
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4 px-1">
          <div className="rounded-xl border bg-muted/20 px-4">
            <DetailRow label="Order ID" value={order.orderId} />
            <DetailRow label="Date" value={formatOrderDate(order.date)} />
            <DetailRow label="Container" value={getContainerLabel(order.containerId)} />
            <DetailRow label="Pending" value={getOrderBranchLabel(order.pending)} />
            <DetailRow label="Branch" value={getOrderBranchLabel(order.branch)} />
            <DetailRow label="Route" value={getRouteName(order.routeId, routes)} />
            <DetailRow label="Route assignment" value={getRouteAssignmentLabel(order.routeAssignmentId)} />
            <DetailRow label="Status" value={getOrderCompletedLabel(order.completed)} />
            <DetailRow label="Date created" value={formatAuditDate(order.createdAt)} />
            <DetailRow label="User created" value={order.createdBy} />
            <DetailRow label="Date modified" value={formatAuditDate(order.updatedAt)} />
          </div>

          <PartyCard title="Sender" party={order.sender} />

          <SenderOrderHistorySection
            sender={order.sender}
            orders={orders}
            currentOrderId={order.orderId}
          />

          {order.receivers.length > 0 ? (
            <div className="space-y-3">
              {order.receivers.map((receiver, index) => (
                <PartyCard key={receiver.id} title={`Receiver ${index + 1}`} party={receiver} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No receivers on this order.
            </div>
          )}

          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Comments ({order.comments.length})
            </p>
            {order.comments.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {order.comments.map((comment) => (
                  <li key={comment.id} className="rounded-lg border bg-background px-3 py-2 text-sm">
                    {formatOrderCommentSummary(comment)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No comments.</p>
            )}
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => onEdit(order)}>
              <Pencil className="h-4 w-4" />
              Edit order
            </Button>
            <Button variant="destructive" onClick={() => onDelete(order)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
