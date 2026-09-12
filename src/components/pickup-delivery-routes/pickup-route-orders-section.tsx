"use client";

import { useMemo, useState } from "react";
import { Loader2, Package, Trash2 } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useUserError } from "@/lib/errors/use-user-error";
import { useTranslation } from "@/lib/i18n";
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
import { usePickupsByRoute } from "@/lib/orders/hooks/use-orders";
import { useUnassignPickupsFromRoute } from "@/lib/orders/hooks/use-orders";
import { cn } from "@/lib/utils";

type PickupRouteOrdersSectionProps = {
  routeId: string;
  enabled?: boolean;
  editable?: boolean;
};

export function PickupRouteOrdersSection({
  routeId,
  enabled = true,
  editable = false,
}: PickupRouteOrdersSectionProps) {
  const { t } = useTranslation();
  const { notifySuccess } = useFeedback();
  const { toErrorMessage } = useUserError();
  const { data, isLoading, isError, error, refetch } = usePickupsByRoute(routeId, { enabled });
  const unassignMutation = useUnassignPickupsFromRoute();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const orders = useMemo(
    () =>
      [...(data?.items ?? [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [data?.items],
  );
  const orderIds = useMemo(() => orders.map((order) => order.id), [orders]);
  const effectiveSelectedIds = useMemo(
    () => selectedIds.filter((id) => orderIds.includes(id)),
    [orderIds, selectedIds],
  );
  const effectiveSelectedOrders = useMemo(
    () => orders.filter((order) => effectiveSelectedIds.includes(order.id)),
    [effectiveSelectedIds, orders],
  );
  const total = data?.total ?? orders.length;
  const errorMessage = isError ? normalizeApiError(error).message : null;
  const dash = t("common.empty.dash");
  const allSelected = orderIds.length > 0 && effectiveSelectedIds.length === orderIds.length;
  const someSelected = effectiveSelectedIds.length > 0 && !allSelected;
  const isUnassigning = unassignMutation.isPending;

  function toggleOrder(orderId: number) {
    setSelectedIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId],
    );
    setActionError(null);
  }

  function toggleAll() {
    setSelectedIds(allSelected ? [] : [...orderIds]);
    setActionError(null);
  }

  async function handleUnassign() {
    if (effectiveSelectedOrders.length === 0) {
      setActionError(t("routes.pickupRoutes.view.orders.selectAtLeastOne"));
      return;
    }

    setActionError(null);

    try {
      const result = await unassignMutation.mutateAsync(effectiveSelectedOrders);

      reportBulkSettled({
        result,
        t,
        notifyError: (message) => setActionError(message),
        onSucceeded: (count) => {
          notifySuccess(
            count === 1
              ? t("routes.pickupRoutes.view.orders.unassigned", { count })
              : t("routes.pickupRoutes.view.orders.unassigned_plural", {
                  count,
                }),
          );
        },
        onAllFailed: (message) => {
          setActionError(message);
        },
        onDone: () => {
          setSelectedIds((current) =>
            current.filter((id) => !result.succeededIds.includes(String(id))),
          );
          void refetch();
        },
      });
    } catch (unassignError) {
      setActionError(toErrorMessage(unassignError));
    }
  }

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            {t("routes.pickupRoutes.view.orders.title", { count: total })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {editable
              ? t("routes.pickupRoutes.view.orders.editDescription")
              : t("routes.pickupRoutes.view.orders.description")}
          </p>
        </div>

        {editable && orders.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={effectiveSelectedIds.length === 0 || isUnassigning}
            onClick={() => void handleUnassign()}
          >
            {isUnassigning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {t("routes.pickupRoutes.view.orders.removeFromRoute")}
          </Button>
        ) : null}
      </div>

      {actionError ? <p className="mt-3 text-sm text-destructive">{actionError}</p> : null}

      {isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("routes.pickupRoutes.view.orders.loading")}
        </p>
      ) : errorMessage ? (
        <p className="mt-4 text-sm text-destructive">{errorMessage}</p>
      ) : orders.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("routes.pickupRoutes.view.orders.empty")}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  {editable ? (
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-input"
                        checked={allSelected}
                        ref={(element) => {
                          if (element) {
                            element.indeterminate = someSelected;
                          }
                        }}
                        onChange={toggleAll}
                        aria-label={t("routes.pickupRoutes.view.orders.selectAllOrders")}
                      />
                    </th>
                  ) : null}
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
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const isSelected = effectiveSelectedIds.includes(order.id);
                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        "border-b last:border-0",
                        isSelected ? "bg-primary/5" : "bg-background",
                      )}
                    >
                      {editable ? (
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-input"
                            checked={isSelected}
                            onChange={() => toggleOrder(order.id)}
                            aria-label={t("routes.pickupRoutes.view.orders.selectOrder", {
                              orderId: order.id,
                            })}
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-2 font-mono text-xs">{order.id}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {formatOrderDate(order.date)}
                      </td>
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
