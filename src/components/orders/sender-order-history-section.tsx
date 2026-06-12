"use client";

import { useMemo } from "react";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { UniformPillWidthProvider, UniformWidthPill } from "@/components/app-shell/uniform-width-pill";
import { formatAuditDate } from "@/lib/audit/display";
import {
  formatOrderDate,
  formatPickupCommentSummary,
  formatUserSummary,
  getCustomerAddressLine,
  getCustomerPhone,
  getOrderCompletedLabel,
  getReceiverAddressLine,
  getReceiverSummary,
} from "@/lib/orders/display";
import { getSenderOrderHistory, type Order } from "@/lib/orders/types";
import type { Customer } from "@/lib/customers/types";
import { cn } from "@/lib/utils";

type SenderOrderHistorySectionProps = {
  sender: Pick<Customer, "id" | "name">;
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
        {senderName} pickup history ({history.length})
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Previous and current pickups for this sender, matched by customer id or name.
      </p>

      {history.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No pickup history yet.</p>
      ) : (
        <UniformPillWidthProvider resetKey={history.map((order) => order.id).join(",")}>
          <div className="mt-4 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">id</th>
                  <th className="px-3 py-2 font-medium">date</th>
                  <th className="px-3 py-2 font-medium">completed</th>
                  <th className="px-3 py-2 font-medium">sender</th>
                  <th className="px-3 py-2 font-medium">sender address</th>
                  <th className="px-3 py-2 font-medium">phone1</th>
                  <th className="px-3 py-2 font-medium">comments</th>
                  <th className="px-3 py-2 font-medium">receiver</th>
                  <th className="px-3 py-2 font-medium">receiver address</th>
                  <th className="px-3 py-2 font-medium">createdAt</th>
                  <th className="px-3 py-2 font-medium">Created by</th>
                  <th className="px-3 py-2 font-medium">updatedAt</th>
                </tr>
              </thead>
              <tbody>
                {history.map((order) => {
                  const isCurrent = String(order.id) === currentOrderId;
                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        "border-b last:border-0",
                        isCurrent ? "bg-primary/5" : "bg-background",
                      )}
                    >
                      <td className="px-3 py-2 font-mono text-xs">
                        {order.oldID > 0 ? order.oldID : order.id}
                        {isCurrent ? (
                          <span className="ml-2 text-[10px] font-sans text-primary">Current</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">{formatOrderDate(order.date)}</td>
                      <td className="px-3 py-2">
                        <UniformWidthPill columnKey="completed">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              order.completed
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                            )}
                          >
                            {getOrderCompletedLabel(order.completed)}
                          </Badge>
                        </UniformWidthPill>
                      </td>
                      <td className="px-3 py-2 text-xs">{order.sender.name}</td>
                      <td className="px-3 py-2 text-xs">{getCustomerAddressLine(order.sender)}</td>
                      <td className="px-3 py-2 text-xs">{getCustomerPhone(order.sender)}</td>
                      <td className="px-3 py-2 text-xs">
                        {order.comments.length > 0
                          ? order.comments.map(formatPickupCommentSummary).join(" · ")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{getReceiverSummary(order)}</td>
                      <td className="px-3 py-2 text-xs">{getReceiverAddressLine(order)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {formatAuditDate(order.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-xs">{formatUserSummary(order.user)}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                        {formatAuditDate(order.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </UniformPillWidthProvider>
      )}
    </div>
  );
}
