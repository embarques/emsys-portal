"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/hooks/use-auth";

import {
  CalendarDays,
  CheckCircle2,
  Eye,
  FilePenLine,
  Info,
  Map as MapIcon,
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
  RecordViewSheet,
  RecordViewSheetActions,
  RecordViewSheetBody,
  RecordViewSheetContent,
  RecordViewSheetDetailRow,
  RecordViewSheetHeader,
  RecordViewSheetSection,
} from "@/components/app-shell/record-view-sheet";
import { RecordViewSheetTabs } from "@/components/app-shell/record-view-sheet-tabs";
import {
  TableSelectionActionsMenu,
  TableSelectionActionItem,
  TableSelectionActionSeparator
} from "@/components/app-shell/table-selection-actions-menu";
import { PhoneActionRow } from "@/components/phones/phone-action-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
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

type ViewPartyTab = "sender" | "receivers";
type ViewSheetTab = "overview" | "history";

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
  initialTab?: ViewSheetTab;
};

function PartyViewSection({
  customer,
  partyLabel,
  nameLabel,
  addressIndex,
}: {
  customer: Customer;
  partyLabel: string;
  nameLabel: string;
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
    <RecordViewSheetSection title={partyLabel} icon={UserRound}>
      <RecordViewSheetDetailRow
        label={nameLabel}
        value={customer.name.trim() || dash}
      />
      {coreAddressHasContent(address) ? (
        <AddressActionRow label={t("orders.view.address")} address={address} />
      ) : (
        <RecordViewSheetDetailRow label={t("orders.view.address")} value={dash} />
      )}
      <RecordViewSheetDetailRow
        label={t("orders.view.idNumber")}
        value={customer.IDNumber || dash}
      />
      <RecordViewSheetDetailRow
        label={t("orders.view.email")}
        value={customer.email || dash}
      />
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
  initialTab = "overview",
}: OrderViewSheetProps) {
  const { t, locale } = useTranslation();
  const { hasPermission } = useAuth();
  const pickupRouteLookup = useActiveRouteLookup("pickup", 500, { enabled: loadRouteDetails && Boolean(order) });
  const [partyTab, setPartyTab] = useState<ViewPartyTab>("sender");
  const [activeTab, setActiveTab] = useState<ViewSheetTab>(initialTab);

  useEffect(() => {
    setPartyTab("sender");
    setActiveTab(initialTab);
  }, [order?.id, initialTab]);

  if (!order) return null;

  const receivers = getOrderReceivers(order);
  const hasReceivers = receivers.length > 0;
  const showingReceivers = hasReceivers && partyTab === "receivers";
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
  const viewTabs: ViewSheetTab[] = ["overview", "history"];

  return (
    <RecordViewSheet open={open} onOpenChange={onOpenChange}>
      <RecordViewSheetContent>
        <RecordViewSheetHeader
          icon={CalendarDays}
          eyebrow={t("orders.entity")}
          title={order.sender.name.trim() || t("orders.history.defaultSenderName")}
        />

        <RecordViewSheetTabs
          idPrefix="order"
          aria-label={t("orders.view.tabs")}
          value={activeTab}
          onValueChange={setActiveTab}
          tabs={viewTabs.map((tab) => ({
            id: tab,
            label: t(
              tab === "overview"
                ? "orders.view.overview"
                : "orders.history.sectionTitle",
            ),
          }))}
        />

        {activeTab === "history" ? (
          <RecordViewSheetBody
            role="tabpanel"
            id="order-panel-history"
            aria-labelledby="order-tab-history"
            className="flex flex-col overflow-hidden bg-muted/30 px-5 py-0"
          >
            <SenderOrderHistorySection
              key={order.id}
              sender={order.sender}
              currentOrderId={String(order.id)}
              variant="embedded"
            />
          </RecordViewSheetBody>
        ) : (
        <RecordViewSheetBody
          role="tabpanel"
          id="order-panel-overview"
          aria-labelledby="order-tab-overview"
        >
          <RecordViewSheetSection title={t("orders.view.general")} icon={CalendarDays}>
            <RecordViewSheetDetailRow
              label={t("orders.columns.date")}
              value={formatOrderDateWithWeekday(order.date, locale)}
            />
            <RecordViewSheetDetailRow
              label={t("orders.columns.purpose")}
              value={
                order.comments.length > 0
                  ? formatOrderCommentsSummary(order)
                  : t("common.empty.dash")
              }
            />
            <RecordViewSheetDetailRow
              label={t("orders.tableColumns.completed")}
              value={
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
              }
            />
          </RecordViewSheetSection>

          {hasReceivers ? (
            <SegmentedControl
              id="view-party-tab"
              aria-label={t("orders.form.workflow.partyTabGroup")}
              value={partyTab}
              onValueChange={setPartyTab}
              className="w-full"
              options={[
                { value: "sender", label: t("orders.form.workflow.partyTabSender") },
                {
                  value: "receivers",
                  label: t("orders.form.workflow.partyTabReceiversCount", {
                    count: receivers.length,
                  }),
                },
              ]}
            />
          ) : null}

          {showingReceivers ? (
            receivers.map((receiver, index) => (
              <PartyViewSection
                key={`${receiver.id}-${index}`}
                customer={receiver}
                partyLabel={
                  receivers.length > 1
                    ? `${t("orders.columns.receiver")} ${index + 1}`
                    : t("orders.columns.receiver")
                }
                nameLabel={t("orders.view.receiverName")}
                addressIndex={0}
              />
            ))
          ) : (
            <PartyViewSection
              customer={order.sender}
              partyLabel={t("orders.columns.sender")}
              nameLabel={t("orders.view.senderName")}
            />
          )}

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
        )}

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
                    <TableSelectionActionItem
                      disabled={actionsDisabled}
                      onSelect={() => onCreateInvoice(order)}
                      className={tableSelectionActionMenuStyles.create}
                    >
                      <Receipt className="size-4" />
                      {t("orders.actions.createInvoice")}
                    </TableSelectionActionItem>
                  ) : null}
                  {showMarkComplete && onMarkComplete ? (
                    <TableSelectionActionItem
                      disabled={actionsDisabled}
                      onSelect={() => onMarkComplete(order)}
                      className={tableSelectionActionMenuStyles.complete}
                    >
                      <CheckCircle2 className="size-4" />
                      {t("orders.actions.markComplete")}
                    </TableSelectionActionItem>
                  ) : null}
                  {showMarkIncomplete && onMarkIncomplete ? (
                    <TableSelectionActionItem
                      disabled={actionsDisabled}
                      onSelect={() => onMarkIncomplete(order)}
                      className={tableSelectionActionMenuStyles.caution}
                    >
                      <XCircle className="size-4" />
                      {t("orders.actions.markIncomplete")}
                    </TableSelectionActionItem>
                  ) : null}

                  {showRouteActions &&
                  (onCreateInvoice || showMarkComplete || showMarkIncomplete) ? (
                    <TableSelectionActionSeparator />
                  ) : null}

                  {showAssignRoute && onAssignRoute ? (
                    <TableSelectionActionItem
                      disabled={actionsDisabled}
                      onSelect={() => onAssignRoute(order)}
                      className={tableSelectionActionMenuStyles.assign}
                    >
                      <RouteIcon className="size-4" />
                      {t("orders.actions.assignRoute")}
                    </TableSelectionActionItem>
                  ) : null}
                  {showViewRoute && onViewRoute ? (
                    <TableSelectionActionItem
                      disabled={!hasRoute}
                      onSelect={() => onViewRoute(order)}
                      className={tableSelectionActionMenuStyles.view}
                    >
                      <Eye className="size-4" />
                      {t("orders.actions.viewRoute")}
                    </TableSelectionActionItem>
                  ) : null}
                  {showClearRoute && onClearRoute ? (
                    <TableSelectionActionItem
                      disabled={actionsDisabled || !canClearRoute}
                      onSelect={() => onClearRoute(order)}
                      className={tableSelectionActionMenuStyles.caution}
                    >
                      <RouteOff className="size-4" />
                      {t("orders.actions.clearRoute")}
                    </TableSelectionActionItem>
                  ) : null}

                  {(onMap || allowRequestChange) &&
                  (onCreateInvoice ||
                    showMarkComplete ||
                    showMarkIncomplete ||
                    showRouteActions) ? (
                    <TableSelectionActionSeparator />
                  ) : null}

                  {onMap ? (
                    <TableSelectionActionItem
                      disabled={actionsDisabled}
                      onSelect={() => onMap(order)}
                      className={tableSelectionActionMenuStyles.map}
                    >
                      <MapIcon className="size-4" />
                      {t(canManageRoutes === false ? "orders.actions.viewInMap" : "orders.actions.map")}
                    </TableSelectionActionItem>
                  ) : null}
                  {allowRequestChange ? (
                    <TableSelectionActionItem asChild className={tableSelectionActionMenuStyles.request}>
                      <Link href={changeRequestHref("pickup", String(order.id))}>
                        <FilePenLine className="size-4" />
                        {t("accounting.journalLifecycle.request")}
                      </Link>
                    </TableSelectionActionItem>
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
