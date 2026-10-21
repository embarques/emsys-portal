"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, History, Loader2 } from "lucide-react";

import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useSenderOrderHistory } from "@/lib/orders/hooks/use-orders";
import {
  formatOrderCommentsSummary,
  formatOrderDate,
  formatUserSummary,
  getCustomerAddressLine,
  getReceiverAddressLine,
  getReceiverSummary,
} from "@/lib/orders/display";
import type { Customer } from "@/lib/customers/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

type SenderOrderHistorySectionProps = {
  sender: Pick<Customer, "id" | "name">;
  currentOrderId?: string;
  variant?: "form" | "view" | "embedded";
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
    enabled: open || variant === "embedded",
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

  const showTable = Boolean(senderId) && !isLoading && !errorMessage && history.length > 0;
  const headerClassName = cn(
    "px-3 py-2 font-medium",
    isView && "whitespace-nowrap",
  );
  const cellClassName = "px-3 py-2 text-xs text-foreground";

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
    <div className={cn("overflow-x-auto", !isView && "rounded-lg border")}>
      <table className={cn("w-full text-left", isView ? "text-xs" : "min-w-[760px] text-sm")}>
          <thead>
            <tr
              className={cn(
                "border-b text-muted-foreground",
                isView ? "bg-muted/40" : "bg-muted/50 text-xs",
              )}
            >
              <th className={headerClassName}>{t("orders.columns.date")}</th>
              <th className={headerClassName}>{t("orders.columns.senderAddressLine")}</th>
              <th className={headerClassName}>{t("orders.columns.comments")}</th>
              <th className={headerClassName}>{t("orders.columns.receiver")}</th>
              <th className={headerClassName}>{t("orders.columns.receiverAddress")}</th>
              <th className={headerClassName}>{t("orders.columns.createdAt")}</th>
              <th className={headerClassName}>{t("orders.columns.createdBy")}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((order) => {
              const isCurrent = String(order.id) === currentOrderId;
              return (
                <tr
                  key={order.id}
                  className={cn(
                    "border-b last:border-b-0",
                    isView
                      ? "even:bg-muted/25"
                      : isCurrent
                        ? "bg-primary/5"
                        : "bg-background",
                  )}
                >
                  <td className={cn(cellClassName, "whitespace-nowrap")}>
                    {formatOrderDate(order.date)}
                    {isCurrent ? (
                      <span className="ml-2 text-[10px] text-primary">
                        {t("orders.history.current")}
                      </span>
                    ) : null}
                  </td>
                  <td className={cn(cellClassName, "min-w-[10rem] leading-snug [overflow-wrap:anywhere]")}>
                    {getCustomerAddressLine(order.sender)}
                  </td>
                  <td className={cn(cellClassName, "min-w-[8rem] leading-snug [overflow-wrap:anywhere]")}>
                    {order.comments.length > 0 ? formatOrderCommentsSummary(order) : dash}
                  </td>
                  <td className={cn(cellClassName, "whitespace-nowrap")}>{getReceiverSummary(order)}</td>
                  <td className={cn(cellClassName, "min-w-[10rem] leading-snug [overflow-wrap:anywhere]")}>
                    {getReceiverAddressLine(order)}
                  </td>
                  <td className={cn(cellClassName, "whitespace-nowrap", !isView && "text-muted-foreground")}>
                    {formatAuditDateTime(order.createdAt)}
                  </td>
                  <td className={cn(cellClassName, "whitespace-nowrap")}>{formatUserSummary(order.createdBy)}</td>
                </tr>
              );
            })}
          </tbody>
      </table>
    </div>
  );

  if (variant === "embedded") {
    return (
      <div className="min-w-0 space-y-2.5">
        <p className="text-sm text-muted-foreground">{sectionTitle}</p>
        {content}
      </div>
    );
  }

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
        <span className="flex min-w-0 items-center gap-2.5">
          {isView ? (
            <span className="h-3.5 w-0.5 shrink-0 rounded-full bg-primary/80" aria-hidden />
          ) : (
            <History className="size-4 shrink-0 text-primary" />
          )}
          <span
            className={cn(
              "truncate uppercase",
              isView
                ? "text-[11px] font-bold tracking-[0.1em] text-foreground/75"
                : "text-xs font-semibold tracking-wide text-muted-foreground",
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
        <div id={`${sectionId}-panel`} className={cn(isView && !showTable && "p-4")}>
          {content}
        </div>
      ) : null}
    </section>
  );
}
