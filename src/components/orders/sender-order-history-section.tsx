"use client";

import { useMemo } from "react";
import { History, Loader2 } from "lucide-react";

import { RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { FormSection } from "@/components/forms/form-shell";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDate } from "@/lib/audit/display";
import { useSenderOrderHistory } from "@/lib/orders/hooks/use-orders";
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
  const senderId = sender.id.trim();
  const { data, isLoading, isError, error } = useSenderOrderHistory(senderId);

  // The API already sorts by date desc; sort defensively in case that changes.
  const history = useMemo(
    () =>
      [...(data?.items ?? [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [data?.items],
  );
  const senderName = sender.name.trim() || t("orders.history.defaultSenderName");
  const sectionTitle = t("orders.history.title", { name: senderName, count: history.length });
  const errorMessage = isError ? normalizeApiError(error).message : null;
  const dash = t("common.empty.dash");

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
                    {order.comments.length > 0
                      ? order.comments.map(formatPickupCommentSummary).join(" · ")
                      : dash}
                  </td>
                  <td className="px-3 py-2 text-xs">{getReceiverSummary(order)}</td>
                  <td className="px-3 py-2 text-xs">{getReceiverAddressLine(order)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {formatAuditDate(order.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs">{formatUserSummary(order.createdBy)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {formatAuditDate(order.updatedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
      </table>
    </div>
  );

  if (variant === "view") {
    return (
      <RecordViewSheetSection title={sectionTitle} icon={History} padding="relaxed">
        {content}
      </RecordViewSheetSection>
    );
  }

  return (
    <FormSection icon={History} title={sectionTitle}>
      {content}
    </FormSection>
  );
}
