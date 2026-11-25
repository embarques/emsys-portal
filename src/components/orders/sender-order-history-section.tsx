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
import {
  CompactTableScroll,
  compactTableCaptionClassName,
  compactTableCellClassName,
  compactTableClassName,
  compactTableHeadClassName,
  compactTableHeadRowClassName,
  compactTableRowClassName,
  compactTableShellClassName,
} from "@/components/ui/compact-table";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";

type SenderOrderHistorySectionProps = {
  sender: Pick<Customer, "id" | "name">;
  currentOrderId?: string;
  variant?: "form" | "view" | "embedded";
};

function CompactCell({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return <td className={cn(compactTableCellClassName, className)}>{value}</td>;
}

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
  const isEmbedded = variant === "embedded";
  const isCompact = isView || isEmbedded;

  const showTable = Boolean(senderId) && !isLoading && !errorMessage && history.length > 0;
  const statusMessage = !senderId ? (
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
  ) : null;

  const table = showTable ? (
    <table className={cn(compactTableClassName, !isCompact && "text-sm")}>
      <thead>
        <tr className={compactTableHeadRowClassName}>
          {(
            [
              "orders.columns.date",
              "orders.columns.senderAddressLine",
              "orders.columns.comments",
              "orders.columns.receiver",
              "orders.columns.receiverAddress",
              "orders.columns.createdAt",
              "orders.columns.createdBy",
            ] as const
          ).map((key) => (
            <th key={key} className={compactTableHeadClassName}>
              {t(key)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {history.map((order) => {
          const isCurrent = String(order.id) === currentOrderId;
          const senderAddress = getCustomerAddressLine(order.sender);
          const comments =
            order.comments.length > 0 ? formatOrderCommentsSummary(order) : dash;
          const receiver = getReceiverSummary(order);
          const receiverAddress = getReceiverAddressLine(order);
          const createdAt = formatAuditDateTime(order.createdAt);
          const createdBy = formatUserSummary(order.createdBy);

          return (
            <tr
              key={order.id}
              className={cn(
                isCompact
                  ? compactTableRowClassName
                  : cn(
                      compactTableRowClassName,
                      isCurrent ? "bg-primary/5" : "bg-background",
                    ),
              )}
            >
              <td className={compactTableCellClassName}>
                {formatOrderDate(order.date)}
                {isCurrent ? (
                  <span className="ml-1.5 text-[10px] text-primary">
                    {t("orders.history.current")}
                  </span>
                ) : null}
              </td>
              <CompactCell value={senderAddress} />
              <CompactCell value={comments} />
              <CompactCell value={receiver} />
              <CompactCell value={receiverAddress} />
              <CompactCell
                value={createdAt}
                className={cn(!isCompact && "text-muted-foreground")}
              />
              <CompactCell value={createdBy} />
            </tr>
          );
        })}
      </tbody>
    </table>
  ) : null;

  const content = statusMessage ? (
    <div className={cn(isEmbedded ? "p-4" : undefined)}>{statusMessage}</div>
  ) : (
    <CompactTableScroll
      aria-label={sectionTitle}
      className={cn(
        !isView && !isEmbedded && "rounded-lg border",
        isEmbedded && "h-full min-h-0",
      )}
    >
      {table}
    </CompactTableScroll>
  );

  if (isEmbedded) {
    return (
      <div
        // Square corners + no top border so the table sits flush under view-sheet tabs.
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border border-t-0 border-border bg-card"
      >
        <div id={`${sectionId}-panel`} className="min-h-0 flex-1 min-w-0">
          <CompactTableScroll aria-labelledby={sectionId} className="h-full min-h-0">
          {statusMessage ? (
            <div className="p-4">{statusMessage}</div>
          ) : (
            table
          )}
          </CompactTableScroll>
        </div>
        <p id={sectionId} className={compactTableCaptionClassName}>
          {sectionTitle}
        </p>
      </div>
    );
  }

  return (
    <section
      className={cn(
        isView && cn(compactTableShellClassName, "shadow-sm"),
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
          <History className="size-4 shrink-0 text-primary" />
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
