"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { RequestChangeButton } from "@/components/change-requests/request-change-button";

import {
  CheckCircle2,
  Info,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Pencil,
  Phone as PhoneIcon,
  Printer,
  Receipt,
  Route as RouteIcon,
  RouteOff,
  Trash2,
  UserRound,
  XCircle,
  Eye,
} from "lucide-react";

import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
import { AddressActionRow } from "@/components/addresses/address-action-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TableSelectionActionDivider,
  TableSelectionExpandableActionGroup,
} from "@/components/app-shell/table-selection-action-group";
import {
  RecordViewSheet,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { getOrderedRecordPhones } from "@/lib/phones/phones";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  formatOrderDateWithWeekday,
  formatOrderId,
  formatOrderRouteName,
  formatPickupCommentSummary,
  formatUserSummary,
  getOrderCompletedLabel,
} from "@/lib/orders/display";
import { useActiveRouteLookup } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { coreAddressHasContent, getCustomerPrimaryCoreAddress, type Customer } from "@/lib/customers/types";
import { getOrderPartyAddressAtIndex, getOrderReceivers, type Order } from "@/lib/orders/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";

type OrderViewSheetProps = {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (order: Order) => void;
  onDelete?: (order: Order) => void;
  canEdit?: boolean;
  loadRouteDetails?: boolean;
  /** Omit to hide Create invoice (e.g. no invoice access). */
  onCreateInvoice?: (order: Order) => void;
  onMap?: (order: Order) => void;
  onPrint?: (order: Order) => void;
  isPrinting?: boolean;
  onMarkComplete?: (order: Order) => void;
  onMarkIncomplete?: (order: Order) => void;
  canManageCompletion?: boolean;
  onAssignRoute?: (order: Order) => void;
  onViewRoute?: (order: Order) => void;
  onClearRoute?: (order: Order) => void;
  /** Hide route actions in route-appointments mode. */
  canManageRoutes?: boolean;
  actionsDisabled?: boolean;
};

function PartyViewSections({
  customer,
  partyLabel,
  addressIndex,
}: {
  customer: Customer;
  partyLabel: string;
  addressIndex?: number;
}) {
  const { t } = useTranslation();
  const phones = getOrderedRecordPhones(customer.phones);
  const address =
    addressIndex == null
      ? getCustomerPrimaryCoreAddress(customer)
      : getOrderPartyAddressAtIndex(customer, addressIndex);
  const dash = t("common.empty.dash");

  return (
    <>
      <RecordViewSheetSection title={partyLabel} icon={UserRound}>
        <RecordViewSheetDetailRow
          label={t("orders.view.name")}
          value={customer.name.trim() || dash}
        />
        <RecordViewSheetDetailRow
          label={t("orders.view.idNumber")}
          value={customer.IDNumber || dash}
        />
        <RecordViewSheetDetailRow
          label={t("orders.view.email")}
          value={customer.email || dash}
        />
      </RecordViewSheetSection>

      <RecordViewSheetSection
        title={t("orders.view.senderPhones", { party: partyLabel })}
        icon={PhoneIcon}
      >
        {phones.length === 0 ? (
          <RecordViewSheetDetailRow label={t("orders.view.phones")} value={dash} />
        ) : (
          phones.map((phone, index) => (
            <PhoneActionRow
              key={`${partyLabel}-phone-${index}`}
              label={t(`phones.types.${phone.type}`)}
              number={phone.number}
              displayNumber={phone.displayNumber}
              isPrimary={phone.isPrimary}
            />
          ))
        )}
      </RecordViewSheetSection>

      <RecordViewSheetSection
        title={t("orders.view.senderAddress", { party: partyLabel })}
        icon={MapPin}
      >
        {coreAddressHasContent(address) ? (
          <AddressActionRow
            label=""
            address={address}
            isPrimary={address.isPrimary || addressIndex == null || addressIndex === 0}
          />
        ) : (
          <RecordViewSheetDetailRow label={t("orders.view.address")} value={dash} />
        )}
      </RecordViewSheetSection>
    </>
  );
}

export function OrderViewSheet({
  order,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onCreateInvoice,
  onMap,
  onPrint,
  isPrinting = false,
  onMarkComplete,
  onMarkIncomplete,
  canManageCompletion,
  onAssignRoute,
  onViewRoute,
  onClearRoute,
  canManageRoutes = true,
  canEdit,
  loadRouteDetails = true,
  actionsDisabled = false,
}: OrderViewSheetProps) {
  const { t, locale } = useTranslation();
  const { hasPermission } = useAuth();
  const pickupRouteLookup = useActiveRouteLookup("pickup", 500, { enabled: loadRouteDetails && Boolean(order) });
  const [completionExpanded, setCompletionExpanded] = useState(false);
  const [routesExpanded, setRoutesExpanded] = useState(false);

  useEffect(() => {
    if (!open) {
      setCompletionExpanded(false);
      setRoutesExpanded(false);
    }
  }, [open]);

  if (!order) return null;

  const receivers = getOrderReceivers(order);
  const allowEdit = canEdit ?? hasPermission("canUpdatePickup", "pickup");
  const allowDelete = Boolean(onDelete) && hasPermission("canDeletePickup", "pickup");
  const allowCompletion = canManageCompletion ?? allowEdit;
  const hasRoute = Boolean(order.routeId?.trim());
  const canClearRoute = hasRoute && !order.completed;
  const showCompletionActions = Boolean(onMarkComplete || onMarkIncomplete) && allowCompletion;
  const showRouteActions =
    canManageRoutes && Boolean(onAssignRoute || onViewRoute || onClearRoute);
  const showPrimaryOps = Boolean(onCreateInvoice || onMap || onPrint);
  const showManageGroups = showCompletionActions || showRouteActions;

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          title={order.sender.name.trim() || t("orders.history.defaultSenderName")}
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {formatOrderDateWithWeekday(order.date, locale)}
              </span>
              <Badge
                variant="outline"
                className={
                  order.completed
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }
              >
                {getOrderCompletedLabel(order.completed, t)}
              </Badge>
            </div>
          }
        />

        <RecordViewSheetBody>
          <PartyViewSections
            customer={order.sender}
            partyLabel={t("orders.columns.sender")}
          />

          <RecordViewSheetSection
            title={t("orders.comments.title")}
            icon={MessageSquare}
            padding="relaxed"
          >
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
              <p className="text-sm text-muted-foreground">{t("orders.empty.noComments")}</p>
            )}
          </RecordViewSheetSection>

          {receivers.length > 0 ? (
            receivers.map((receiver, index) => (
              <PartyViewSections
                key={`${receiver.id}-${index}`}
                customer={receiver}
                partyLabel={
                  receivers.length > 1
                    ? `${t("orders.columns.receiver")} ${index + 1}`
                    : t("orders.columns.receiver")
                }
                addressIndex={0}
              />
            ))
          ) : (
            <RecordViewSheetSection title={t("orders.columns.receiver")} icon={UserRound} padding="relaxed">
              <p className="text-sm text-muted-foreground">{t("orders.empty.noReceiver")}</p>
            </RecordViewSheetSection>
          )}

          <SenderOrderHistorySection
            sender={order.sender}
            currentOrderId={String(order.id)}
            variant="view"
          />

          <RecordViewSheetSection title={t("orders.view.system")} icon={Info}>
            <RecordViewSheetDetailRow
              label={t("orders.columns.route")}
              value={formatOrderRouteName(order, pickupRouteLookup.getByKey(order.routeId), t)}
            />
            <RecordViewSheetDetailRow
              label={t("orders.view.pickupId")}
              value={formatOrderId(order)}
            />
            <RecordViewSheetDetailRow label={t("orders.columns.branchId")} value={String(order.branch.id)} />
            <RecordViewSheetDetailRow label={t("orders.columns.branchName")} value={order.branch.name} />
            <RecordViewSheetDetailRow label={t("orders.columns.branchCode")} value={order.branch.code} />
            <RecordViewSheetDetailRow
              label={t("orders.columns.createdAt")}
              value={formatAuditDateTime(order.createdAt)}
            />
            <RecordViewSheetDetailRow
              label={t("orders.columns.createdBy")}
              value={formatUserSummary(order.createdBy)}
            />
            <RecordViewSheetDetailRow
              label={t("orders.columns.updatedAt")}
              value={formatAuditDateTime(order.updatedAt)}
            />
            <RecordViewSheetDetailRow
              label={t("common.audit.updatedBy")}
              value={formatUserSummary(order.updatedBy)}
            />
          </RecordViewSheetSection>
        </RecordViewSheetBody>

        <div className="shrink-0 border-t border-border bg-card px-6 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {showPrimaryOps && !completionExpanded && !routesExpanded ? (
              <>
                {onCreateInvoice ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    disabled={actionsDisabled}
                    onClick={() => onCreateInvoice(order)}
                  >
                    <Receipt className="size-4" />
                    {t("orders.actions.createInvoice")}
                  </Button>
                ) : null}
                {onMap ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    disabled={actionsDisabled}
                    onClick={() => onMap(order)}
                  >
                    <MapIcon className="size-4" />
                    {t("orders.actions.map")}
                  </Button>
                ) : null}
                {onPrint ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
                    disabled={actionsDisabled || isPrinting}
                    onClick={() => onPrint(order)}
                  >
                    <Printer className="size-4" />
                    {isPrinting ? t("orders.actions.preparing") : t("orders.actions.print")}
                  </Button>
                ) : null}
                {showManageGroups || allowEdit || allowDelete ? <TableSelectionActionDivider /> : null}
              </>
            ) : null}

            {showCompletionActions && !routesExpanded ? (
              <>
                <TableSelectionExpandableActionGroup
                  label={t("orders.actions.manageCompletion")}
                  icon={CheckCircle2}
                  expanded={completionExpanded}
                  onExpandedChange={setCompletionExpanded}
                  disabled={actionsDisabled}
                  aria-label={t("orders.actions.completionGroup")}
                >
                  {onMarkComplete ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionsDisabled || order.completed}
                      onClick={() => onMarkComplete(order)}
                      className="bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-300"
                    >
                      <CheckCircle2 className="size-4" />
                      {t("orders.actions.markComplete")}
                    </Button>
                  ) : null}
                  {onMarkIncomplete ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionsDisabled || !order.completed}
                      onClick={() => onMarkIncomplete(order)}
                      className="bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300"
                    >
                      <XCircle className="size-4" />
                      {t("orders.actions.markIncomplete")}
                    </Button>
                  ) : null}
                </TableSelectionExpandableActionGroup>
                {showRouteActions || allowEdit || allowDelete ? <TableSelectionActionDivider /> : null}
              </>
            ) : null}

            {showRouteActions ? (
              <TableSelectionExpandableActionGroup
                label={t("orders.actions.manageRoutes")}
                icon={RouteIcon}
                expanded={routesExpanded}
                onExpandedChange={(expanded) => {
                  setRoutesExpanded(expanded);
                  if (expanded) setCompletionExpanded(false);
                }}
                disabled={actionsDisabled}
                aria-label={t("orders.actions.routeGroup")}
              >
                {onAssignRoute ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionsDisabled}
                    onClick={() => onAssignRoute(order)}
                  >
                    <RouteIcon className="size-4" />
                    {t("orders.actions.assignRoute")}
                  </Button>
                ) : null}
                {onViewRoute ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasRoute}
                    onClick={() => onViewRoute(order)}
                    className={tableSelectionActionStyles.view}
                  >
                    <Eye className="size-4" />
                    {t("orders.actions.viewRoute")}
                  </Button>
                ) : null}
                {onClearRoute ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionsDisabled || !canClearRoute}
                    onClick={() => onClearRoute(order)}
                    className="bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300"
                  >
                    <RouteOff className="size-4" />
                    {t("orders.actions.clearRoute")}
                  </Button>
                ) : null}
              </TableSelectionExpandableActionGroup>
            ) : null}

            <RequestChangeButton resourceType="pickup" resourceId={String(order.id)} />

            {allowEdit || allowDelete ? <TableSelectionActionDivider /> : null}

            {allowEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={actionsDisabled}
                onClick={() => onEdit(order)}
                className={cn("whitespace-nowrap", tableSelectionActionStyles.edit)}
              >
                <Pencil className="size-4" />
                {t("orders.actions.editPickup")}
              </Button>
            ) : null}
            {allowDelete && onDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={actionsDisabled}
                onClick={() => onDelete(order)}
                className={cn("whitespace-nowrap", tableSelectionActionStyles.delete)}
              >
                <Trash2 className="size-4" />
                {t("common.actions.delete")}
              </Button>
            ) : null}
          </div>
        </div>
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
