"use client";

import { useMemo } from "react";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatAuditDate } from "@/lib/audit/display";
import {
  formatOrderCommentSummary,
  formatOrderDate,
  getOrderCompletedLabel,
  getOrderPartyAddressLine,
  getOrderPartyPhone,
  getOrderReceiverAddressLine,
  getOrderReceiverSummary,
  truncateOrderId,
} from "@/lib/orders/display";
import { getSenderOrderHistory, type Order } from "@/lib/orders/types";
import { cn } from "@/lib/utils";

type SenderOrderHistorySectionProps = {
  sender: Order["sender"];
  orders: Order[];
  currentOrderId?: string;
};

export function SenderOrderHistorySection({
  sender,
  orders,
  currentOrderId,
}: SenderOrderHistorySectionProps) {
  const history = useMemo(() => getSenderOrderHistory(orders, sender), [orders, sender]);

  const senderName = sender.name.trim() || "Sender";

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        {senderName} order history ({history.length})
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Previous and current orders for this sender, matched by customer or name.
      </p>

      {history.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No order history yet. Enter a sender name or load from the customer directory.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Order ID</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Sender</th>
                <th className="px-3 py-2 font-medium">Sender address 1</th>
                <th className="px-3 py-2 font-medium">Phone 1</th>
                <th className="px-3 py-2 font-medium">Comments</th>
                <th className="px-3 py-2 font-medium">Receiver</th>
                <th className="px-3 py-2 font-medium">Receiver address 1</th>
                <th className="px-3 py-2 font-medium">Date created</th>
                <th className="px-3 py-2 font-medium">User created</th>
                <th className="px-3 py-2 font-medium">Date modified</th>
              </tr>
            </thead>
            <tbody>
              {history.map((order) => {
                const isCurrent = order.orderId === currentOrderId;
                return (
                  <tr
                    key={order.orderId}
                    className={cn(
                      "border-b last:border-0",
                      isCurrent ? "bg-primary/5" : "bg-background"
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {truncateOrderId(order.orderId)}
                      {isCurrent ? (
                        <span className="ml-2 text-[10px] font-sans text-primary">Current</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{formatOrderDate(order.date)}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          order.completed
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {getOrderCompletedLabel(order.completed)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">{order.sender.name}</td>
                    <td className="px-3 py-2 text-xs">{getOrderPartyAddressLine(order.sender, 0)}</td>
                    <td className="px-3 py-2 text-xs">{getOrderPartyPhone(order.sender, 0)}</td>
                    <td className="px-3 py-2 text-xs">
                      {order.comments.length > 0
                        ? order.comments.map(formatOrderCommentSummary).join(" · ")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">{getOrderReceiverSummary(order)}</td>
                    <td className="px-3 py-2 text-xs">{getOrderReceiverAddressLine(order)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {formatAuditDate(order.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-xs">{order.createdBy}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {formatAuditDate(order.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
