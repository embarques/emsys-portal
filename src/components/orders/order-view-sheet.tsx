"use client";

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
import { formatCoreAddressLine, formatPhoneList } from "@/lib/customers/display";
import { formatAuditDate } from "@/lib/audit/display";
import { formatTableColumnLabel } from "@/lib/table/column-labels";
import {
  formatCustomerPartySummary,
  formatEmployeeSummary,
  formatOrderDate,
  formatOrderId,
  formatPickupCommentSummary,
  formatUserSummary,
  getOrderBranchLabel,
  getOrderCompletedLabel,
} from "@/lib/orders/display";
import type { Customer } from "@/lib/customers/types";
import type { Order } from "@/lib/orders/types";
import { getBranchBadgeClass } from "@/lib/trucks/display";

type OrderViewSheetProps = {
  order: Order | null;
  orders: Order[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
};

function CustomerCard({ title, customer }: { title: string; customer: Customer }) {
  return (
    <RecordViewSheetSection title={title} padding="relaxed">
      <p className="text-sm font-medium">{customer.name}</p>
      {customer.oldID > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">oldID: {customer.oldID}</p>
      ) : null}
      {customer.IDNumber ? (
        <p className="text-xs text-muted-foreground">IDNumber: {customer.IDNumber}</p>
      ) : null}
      {customer.email ? <p className="text-xs text-muted-foreground">{customer.email}</p> : null}
      <p className="mt-3 text-xs text-muted-foreground">{formatPhoneList(customer)}</p>
      <div className="mt-4 space-y-1">
        <p className="text-xs font-medium text-primary">address</p>
        <p className="text-sm leading-relaxed">{formatCoreAddressLine(customer.address) || "—"}</p>
      </div>
    </RecordViewSheetSection>
  );
}

export function OrderViewSheet({ order, orders, open, onOpenChange, onEdit, onDelete }: OrderViewSheetProps) {
  if (!order) return null;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={`Pickup ${formatOrderId(order)}`}
          description={formatOrderDate(order.date)}
          meta={
            <>
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
            </>
          }
        />

        <RecordViewSheetBody>
          <RecordViewSheetSection title="Pickup">
            <RecordViewSheetDetailRow label="Order ID" value={String(order.id)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("oldID")} value={order.oldID > 0 ? String(order.oldID) : "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("date")} value={formatOrderDate(order.date)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("completed")} value={getOrderCompletedLabel(order.completed)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("purpose")} value={order.purpose || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.id")} value={String(order.branch.id)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.name")} value={order.branch.name || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("branch.code")} value={order.branch.code || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("sector.id")} value={order.sector ? String(order.sector.id) : "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("sector.name")} value={order.sector?.name || "—"} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("employee")} value={formatEmployeeSummary(order.employee)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("user")} value={formatUserSummary(order.user)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("createdAt")} value={formatAuditDate(order.createdAt)} />
            <RecordViewSheetDetailRow label={formatTableColumnLabel("updatedAt")} value={formatAuditDate(order.updatedAt)} />
          </RecordViewSheetSection>

          <CustomerCard title="sender" customer={order.sender} />

          <SenderOrderHistorySection sender={order.sender} orders={orders} currentOrderId={String(order.id)} />

          {order.receiver ? (
            <CustomerCard title="receiver" customer={order.receiver} />
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 px-5 py-8 text-center text-sm text-muted-foreground">
              No receiver on this pickup.
            </div>
          )}

          <RecordViewSheetSection title={`comments (${order.comments.length})`} padding="relaxed">
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
              <p className="text-sm text-muted-foreground">No comments.</p>
            )}
          </RecordViewSheetSection>

          <RecordViewSheetSection title="Summary" padding="relaxed">
            <p className="text-sm text-muted-foreground">{formatCustomerPartySummary(order.sender)}</p>
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <RecordViewSheetActions editLabel="Edit pickup" onEdit={() => onEdit(order)} onDelete={() => onDelete(order)} />
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
