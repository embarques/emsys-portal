"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, History, Loader2 } from "lucide-react";

import { TableTagText } from "@/components/app-shell/table-tag-text";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useSenderOrderHistory } from "@/lib/orders/hooks/use-orders";
import {
  formatOrderCommentsSummary,
  formatOrderDate,
  formatUserSummary,
  getCustomerAddressLine,
  getCustomerPhone,
  getOrderCompletedLabel,
  getReceiverAddressLine,
  getReceiverSummary,
} from "@/lib/orders/display";
import type { Customer } from "@/lib/customers/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

type SenderOrderHistorySectionProps = {
  sender: Pick<Customer, "id" | "name">;
  currentOrderId?: string;
  variant?: "form" | "view";
};

export function SenderOrderHistorySection({
  sender,
  currentOrderId,
  variant = "form",
}: SenderOrderHistorySectionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const senderId = sender.id.trim();
  const { data, isLoading, isError, error } = useSenderOrderHistory(senderId, {
    enabled: open,
  });

  useEffect(() => {
    setOpen(false);
  }, [senderId]);

  // The API already sorts by date desc; sort defensively in case that changes.
  const history = useMemo(
    () =>
      [...(data?.items ?? [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [data?.items],
  );
  const senderName = sender.name.trim() || t("orders.history.defaultSenderName");
  const sectionTitle =
    data != null
      ? t("orders.history.title", { name: senderName, count: history.length })
      : t("orders.history.titleCollapsed", { name: senderName });
  const errorMessage = isError ? normalizeApiError(error).message : null;
  const dash = t("common.empty.dash");
  const toggleLabel = open ? t("orders.history.collapse") : t("orders.history.expand");
  const sectionId = "sender-appointment-history";
  const isView = variant === "view";

  const content = !senderId ? (
    <p className="text-sm text-muted-foreground">{t("orders.history.pendingSavedSender")}</p>
  ) : isLoading ? (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t("orders.loading.pickupHistory")}
    </p>
  ) : errorMessage ? (
    <p className="text-sm text-destructive">{errorMessage}</p>
  ) : history.length === 0 ? (
    <p className="text-sm text-muted-foreground">{t("orders.empty.noPickupHistory")}</p>
  ) : (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">{t("orders.columns.orderId")}</th>
              <th className="px-3 py-2 font-medium">{t("orders.columns.date")}</th>
              <th className="px-3 py-2 font-medium">{t("orders.columns.completed")}</th>
              <th className="px-3 py-2 font-medium">{t("orders.columns.sender")}</th>
              <th className="px-3 py-2 font-medium">{t("orders.columns.senderAddressLine")}</th>
              <th className="px-3 py-2 font-medium">{t("orders.columns.phone1")}</th>
              <th className="px-3 py-2 font-medium">{t("orders.columns.comments")}</th>
              <th className="px-3 py-2 font-medium">{t("orders.columns.receiver")}</th>
              <th className="px-3 py-2 font-medium">{t("orders.columns.receiverAddress")}</th>
              <th className="px-3 py-2 font-medium">{t("orders.columns.createdAt")}</th>
              <th className="px-3 py-2 font-medium">{t("orders.columns.createdBy")}</th>
              <th className="px-3 py-2 font-medium">{t("orders.columns.updatedAt")}</th>
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
                    {order.id}
                    {isCurrent ? (
                      <span className="ml-2 text-[10px] font-sans text-primary">
                        {t("orders.history.current")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{formatOrderDate(order.date)}</td>
                  <td className="px-3 py-2">
                    <TableTagText
                      className={
                        order.completed
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-amber-700 dark:text-amber-300"
                      }
                    >
                      {getOrderCompletedLabel(order.completed, t)}
                    </TableTagText>
                  </td>
                  <td className="px-3 py-2 text-xs">{order.sender.name}</td>
                  <td className="px-3 py-2 text-xs">{getCustomerAddressLine(order.sender)}</td>
                  <td className="px-3 py-2 text-xs">{getCustomerPhone(order.sender)}</td>
                  <td className="px-3 py-2 text-xs">
                    {order.comments.length > 0 ? formatOrderCommentsSummary(order) : dash}
                  </td>
                  <td className="px-3 py-2 text-xs">{getReceiverSummary(order)}</td>
                  <td className="px-3 py-2 text-xs">{getReceiverAddressLine(order)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {formatAuditDateTime(order.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs">{formatUserSummary(order.createdBy)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {formatAuditDateTime(order.updatedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
      </table>
    </div>
  );

  return (
    <section
      className={cn(
        isView && "overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        !isView && "space-y-2.5",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={`${sectionId}-panel`}
        title={toggleLabel}
        className={cn(
          "flex w-full items-center justify-between gap-2 text-left transition-colors",
          isView
            ? cn(
                "bg-muted/50 px-4 py-2.5 hover:bg-muted/70",
                open && "border-b border-border",
              )
            : "min-h-7 rounded-md hover:bg-muted/50",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <History className="size-4 shrink-0 text-primary" />
          <span
            className={cn(
              "truncate font-semibold uppercase tracking-wide text-muted-foreground",
              isView ? "text-[11px] tracking-[0.1em] text-foreground/75" : "text-xs",
            )}
          >
            {sectionTitle}
          </span>
        </span>
        <span className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground">
          {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
      </button>
      {open ? (
        <div id={`${sectionId}-panel`} className={cn(isView && "p-4")}>
          {content}
        </div>
      ) : null}
    </section>
  );
}
