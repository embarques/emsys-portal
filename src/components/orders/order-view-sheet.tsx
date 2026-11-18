"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/hooks/use-auth";

import {
  CalendarDays,
  CheckCircle2,
  Eye,
  FilePenLine,
  Info,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Phone as PhoneIcon,
  Printer,
  Receipt,
  Route as RouteIcon,
  RouteOff,
  UserRound,
  XCircle,
} from "lucide-react";

import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
import { AddressActionRow } from "@/components/addresses/address-action-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { TableSelectionActionsMenu } from "@/components/app-shell/table-selection-actions-menu";
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { getOrderedRecordPhones } from "@/lib/phones/phones";
import { formatAuditDateTime } from "@/lib/audit/display";
import { changeRequestHref } from "@/lib/change-requests/utils/navigation";
import {
  formatOrderCommentsSummary,
  formatOrderDateWithWeekday,
  formatOrderId,
  formatOrderRouteName,
  formatUserSummary,
  getOrderCompletedLabel,
} from "@/lib/orders/display";
import { useActiveRouteLookup } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { coreAddressHasContent, getCustomerPrimaryCoreAddress, type Customer } from "@/lib/customers/types";
import { getOrderPartyAddressAtIndex, getOrderReceivers, type Order } from "@/lib/orders/types";
import { useTranslation } from "@/lib/i18n";
import {
  tableSelectionActionMenuStyles,
  tableSelectionActionStyles,
} from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

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

  if (!order) return null;

  const receivers = getOrderReceivers(order);
  const allowEdit = canEdit ?? hasPermission("canUpdatePickup", "pickup");
  const allowDelete = Boolean(onDelete) && hasPermission("canDeletePickup", "pickup");
  const allowCompletion = canManageCompletion ?? allowEdit;
  const allowRequestChange = hasPermission("canCreateChangeRequest", "change_request");
  const hasRoute = Boolean(order.routeId?.trim());
  const canClearRoute = hasRoute && !order.completed;
  const showMarkComplete = Boolean(onMarkComplete) && allowCompletion && !order.completed;
  const showMarkIncomplete = Boolean(onMarkIncomplete) && allowCompletion && order.completed;
  const showAssignRoute = canManageRoutes && Boolean(onAssignRoute);
  const showViewRoute = canManageRoutes && Boolean(onViewRoute);
  const showClearRoute = canManageRoutes && Boolean(onClearRoute);
  const showRouteActions = showAssignRoute || showViewRoute || showClearRoute;
  const showSecondaryActionsMenu = Boolean(
    onCreateInvoice ||
      showMarkComplete ||
      showMarkIncomplete ||
      showRouteActions ||
      onMap ||
      allowRequestChange,
  );
  const showFooter = Boolean(
    showSecondaryActionsMenu || onPrint || allowEdit || allowDelete,
  );

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          icon={CalendarDays}
          eyebrow={t("orders.entity")}
          title={order.sender.name.trim() || t("orders.history.defaultSenderName")}
          meta={
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="size-3.5 shrink-0 opacity-70" aria-hidden />
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

          <RecordViewSheetSection title={t("orders.columns.purpose")} icon={MessageSquare}>
            <div className="border-b border-border/80 px-4 py-2.5 last:border-b-0 even:bg-muted/25">
              <p className="text-xs font-medium leading-snug text-muted-foreground">
                {t("orders.columns.comments")}
              </p>
              <p className="text-sm font-medium leading-snug text-foreground [overflow-wrap:anywhere]">
                {order.comments.length > 0
                  ? formatOrderCommentsSummary(order)
                  : t("common.empty.dash")}
              </p>
            </div>
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

        {showFooter ? (
          <RecordViewSheetActions
            isDisabled={actionsDisabled}
            onEdit={allowEdit ? () => onEdit(order) : undefined}
            onDelete={allowDelete && onDelete ? () => onDelete(order) : undefined}
            leading={
              <>
                {onPrint ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionsDisabled || isPrinting}
                    onClick={() => onPrint(order)}
                    className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
                  >
                    <Printer className="size-4" />
                    {isPrinting ? t("orders.actions.preparing") : t("orders.actions.print")}
                  </Button>
                ) : null}
                <TableSelectionActionsMenu
                  hidden={!showSecondaryActionsMenu}
                  disabled={actionsDisabled}
                  triggerClassName="w-full justify-between sm:w-auto"
                >
                  {onCreateInvoice ? (
                    <DropdownMenuItem
                      disabled={actionsDisabled}
                      onSelect={() => onCreateInvoice(order)}
                      className={tableSelectionActionMenuStyles.create}
                    >
                      <Receipt className="size-4" />
                      {t("orders.actions.createInvoice")}
                    </DropdownMenuItem>
                  ) : null}
                  {showMarkComplete && onMarkComplete ? (
                    <DropdownMenuItem
                      disabled={actionsDisabled}
                      onSelect={() => onMarkComplete(order)}
                      className={tableSelectionActionMenuStyles.complete}
                    >
                      <CheckCircle2 className="size-4" />
                      {t("orders.actions.markComplete")}
                    </DropdownMenuItem>
                  ) : null}
                  {showMarkIncomplete && onMarkIncomplete ? (
                    <DropdownMenuItem
                      disabled={actionsDisabled}
                      onSelect={() => onMarkIncomplete(order)}
                      className={tableSelectionActionMenuStyles.caution}
                    >
                      <XCircle className="size-4" />
                      {t("orders.actions.markIncomplete")}
                    </DropdownMenuItem>
                  ) : null}

                  {showRouteActions &&
                  (onCreateInvoice || showMarkComplete || showMarkIncomplete) ? (
                    <DropdownMenuSeparator />
                  ) : null}

                  {showAssignRoute && onAssignRoute ? (
                    <DropdownMenuItem
                      disabled={actionsDisabled}
                      onSelect={() => onAssignRoute(order)}
                      className={tableSelectionActionMenuStyles.assign}
                    >
                      <RouteIcon className="size-4" />
                      {t("orders.actions.assignRoute")}
                    </DropdownMenuItem>
                  ) : null}
                  {showViewRoute && onViewRoute ? (
                    <DropdownMenuItem
                      disabled={!hasRoute}
                      onSelect={() => onViewRoute(order)}
                      className={tableSelectionActionMenuStyles.view}
                    >
                      <Eye className="size-4" />
                      {t("orders.actions.viewRoute")}
                    </DropdownMenuItem>
                  ) : null}
                  {showClearRoute && onClearRoute ? (
                    <DropdownMenuItem
                      disabled={actionsDisabled || !canClearRoute}
                      onSelect={() => onClearRoute(order)}
                      className={tableSelectionActionMenuStyles.caution}
                    >
                      <RouteOff className="size-4" />
                      {t("orders.actions.clearRoute")}
                    </DropdownMenuItem>
                  ) : null}

                  {(onMap || allowRequestChange) &&
                  (onCreateInvoice ||
                    showMarkComplete ||
                    showMarkIncomplete ||
                    showRouteActions) ? (
                    <DropdownMenuSeparator />
                  ) : null}

                  {onMap ? (
                    <DropdownMenuItem
                      disabled={actionsDisabled}
                      onSelect={() => onMap(order)}
                      className={tableSelectionActionMenuStyles.map}
                    >
                      <MapIcon className="size-4" />
                      {t("orders.actions.map")}
                    </DropdownMenuItem>
                  ) : null}
                  {allowRequestChange ? (
                    <DropdownMenuItem asChild className={tableSelectionActionMenuStyles.request}>
                      <Link href={changeRequestHref("pickup", String(order.id))}>
                        <FilePenLine className="size-4" />
                        {t("accounting.journalLifecycle.request")}
                      </Link>
                    </DropdownMenuItem>
                  ) : null}
                </TableSelectionActionsMenu>
              </>
            }
          />
        ) : null}
      </RecordViewSheetContent>
    </RecordViewSheet>
  );
}
