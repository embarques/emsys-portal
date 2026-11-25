"use client";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Edit,
  Eye,
  FileText,
  Filter,
  Map as MapIcon,
  PackageOpen,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Route as RouteIcon,
  RouteOff,
  Trash2,
  XCircle,
} from "lucide-react";

import { TableStreetAddress } from "@/components/addresses/table-street-address";
import { CustomerTablePhoneCell } from "@/components/customers/customer-table-phone-cell";
import { CustomerUnverifiedAddressAction } from "@/components/customers/customer-unverified-address-action";
import { OrderForm } from "@/components/orders/order-form";
import { DuplicatePendingAppointmentDialog } from "@/components/orders/duplicate-pending-appointment-dialog";
import { OrderViewSheet } from "@/components/orders/order-view-sheet";
import { AssignAppointmentRouteDialog } from "@/components/orders/assign-appointment-route-dialog";
import { AppointmentInvoiceDialogs } from "@/components/orders/appointment-invoice-dialogs";
import { useRouteAppointmentsAccess } from "@/lib/orders/hooks/use-route-appointments-access";
import { useCreateAppointmentInvoice } from "@/lib/orders/hooks/use-create-appointment-invoice";
import { DuplicatePendingAppointmentCancelledError } from "@/lib/orders/duplicate-pending-appointment";
import { useDuplicatePendingAppointmentConfirmation } from "@/lib/orders/hooks/use-duplicate-pending-appointment-confirmation";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useWorkspaceTabScope } from "@/lib/layout/workspace-tab-scope";
import { writeOrdersMapContext } from "@/lib/orders/store/orders-map-context";
import {
  clearOrdersListContext,
  readOrdersListContext,
} from "@/lib/orders/store/orders-list-context";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  DirectoryInsightsFlip,
  DirectoryInsightsToggle,
} from "@/components/app-shell/directory-insights-flip";
import { AppointmentDirectoryInsights } from "@/components/orders/appointment-directory-insights";

import { TableSelectionActionsMenu } from "@/components/app-shell/table-selection-actions-menu";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useApiTableColumns } from "@/components/app-shell/use-api-table-columns";
import { ORDER_API_TABLE_FIELDS } from "@/lib/orders/table-fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { ORDER_TABLE_FILTER_FIELDS } from "@/lib/orders/filter-fields";
import { useOrderFilterFields } from "@/lib/orders/hooks/use-order-filter-fields";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { formatPaginatedListSummary } from "@/lib/table/list-summary";
import { normalizeApiError } from "@/lib/api/axios";
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  formatOrderCommentsSummary,
  formatOrderDate,
  formatOrderCalendarDate,
  formatOrderId,
  formatOrderPurposeLabel,
  formatOrderSenderStreetLine,
  getOrderFeedbackName,
  formatOrderRouteName,
  formatUserSummary,
  buildOrderCreatedByFilterOptions,
  getOrderCompletedLabel,
  formatEmployeeSummary,
} from "@/lib/orders/display";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import { useActiveRouteLookup } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  useClearOrdersRouteAssignments,
  useCreateOrder,
  useDeleteOrders,
  useOrderStats,
  useOrders,
  useRetryOrderLegacySync,
  useSetOrdersCompleted,
  useUpdateOrder,
} from "@/lib/orders/hooks/use-orders";
import {
  DEFAULT_ORDER_LIST_PARAMS,
  buildOrderListParams,
  createEmptyOrderForm,
  getOrderRecordId,
  orderToFormValues,
  type Order,
  type OrderFilterState,
  type OrderFormValues,
  areOrderFormValuesEquivalent,
} from "@/lib/orders/types";
import { isOrderMappable } from "@/lib/orders/utils/pickup-map";
import { buildPickupRouteFilterRows } from "@/lib/orders/pickup-route-filter";
import { PREDEFINED_ROUTE_FILTER_FIELD } from "@/lib/orders/predefined-route-filter";
import { PredefinedRouteFilterRow } from "@/components/orders/predefined-route-filter-row";
import { PredefinedRouteDialog } from "@/components/predefined-routes/predefined-route-dialog";
import { usePredefinedRouteWorkspace } from "@/lib/predefined-routes/hooks/use-predefined-route-workspace";
import { usePredefinedRouteFilterOptions } from "@/lib/predefined-routes/hooks/use-predefined-routes";
import { useUsers } from "@/lib/users/hooks/use-users";
import { useGeneratePickupReport } from "@/lib/reports/hooks/use-reports";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import {
  ADDRESS_TEXT_WRAP_CLASSNAME,
  formatAddressLine,
  getAddressLabelKey,
  getPrimaryAddress,
} from "@/lib/customers/utils/address-utils";
import type { Customer } from "@/lib/customers/types";
import { cn } from "@/lib/utils";
import {
  tableSelectionActionMenuStyles,
  tableSelectionActionStyles,
} from "@/lib/table/selection-action-styles";
import type { DataTableColumn } from "@/lib/table/types";
import { useTranslation } from "@/lib/i18n";

const PICKUP_ACCESS_UNAVAILABLE_PREFIX = "Pickup access unavailable.";

function OrderTableAddressCell({ customer }: { customer: Customer }) {
  const { t } = useTranslation();
  const primary = getPrimaryAddress(customer);

  return (
    <TableStreetAddress
      address={primary}
      emptyLabel={t("common.empty.dash")}
      action={
        primary ? (
          <CustomerUnverifiedAddressAction
            customer={customer}
            address={primary}
            label={t(getAddressLabelKey(primary, 0))}
          />
        ) : null
      }
    />
  );
}

function formatAddressPart(
  customer: Customer,
  part: "city" | "state" | "zipcode",
  dash: string,
) {
  const value = getPrimaryAddress(customer)?.[part]?.trim() ?? "";
  return value || dash;
}

function formatPickupTableDate(date: string): string {
  const trimmed = date?.trim();
  if (!trimmed) return "—";

  const parsed = trimmed.includes("T")
    ? new Date(trimmed)
    : new Date(`${trimmed.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function PickupCommentsCell({ order }: { order: Order }) {
  const summary = formatOrderCommentsSummary(order);

  return (
    <div className={cn("w-full", ADDRESS_TEXT_WRAP_CLASSNAME)}>
      <p className={cn(ADDRESS_TEXT_WRAP_CLASSNAME, "leading-snug")} title={summary}>
        {summary}
      </p>
    </div>
  );
}

function getCustomerPrimaryPhone(customer: Customer | null | undefined, fallback: string) {
  const phone = customer?.phones?.[0];
  return phone?.displayNumber || phone?.number || fallback;
}

function MobileOrderRow({
  order,
  onView,
  onEdit,
  onDelete,
  canDelete = true,
  canEdit = true,
  canRetryLegacySync = true,
  onRetryLegacySync,
  selected,
  selectionMode,
  retryingLegacySync,
  onToggleSelected,
}: {
  order: Order;
  onView: (order: Order) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
  canDelete?: boolean;
  canEdit?: boolean;
  canRetryLegacySync?: boolean;
  onRetryLegacySync: (order: Order) => void;
  selected: boolean;
  selectionMode: boolean;
  retryingLegacySync: boolean;
  onToggleSelected: (orderId: string, checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const orderId = getOrderRecordId(order);
  const senderAddress = getPrimaryAddress(order.sender);
  const senderAddressLine = senderAddress ? formatAddressLine(senderAddress, "full") : dash;
  const senderPhone = getCustomerPrimaryPhone(order.sender, dash);
  const comments = formatOrderCommentsSummary(order);

  return (
    <article className={cn("min-w-0 border-b border-border/80 py-5 last:border-b-0", selected && "bg-primary/5")}>
      <div className="grid w-full min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
        <button
          type="button"
          className={cn(
            "mt-1 flex size-7 items-center justify-center rounded-full border text-primary",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
          )}
          onClick={() => onToggleSelected(orderId, !selected)}
          aria-label={selected ? t("orders.workspace.deselectOrder") : t("orders.workspace.selectOrder")}
        >
          {selected ? <Check className="size-4" /> : null}
        </button>
        <button
          type="button"
          className="min-w-0 text-left"
          onClick={() => {
            if (selectionMode) {
              onToggleSelected(orderId, !selected);
              return;
            }
            onView(order);
          }}
        >
          <span className="block truncate text-xl font-bold leading-tight text-foreground">
            {order.sender.name || dash}
          </span>
          <span className="mt-1 flex min-w-0 items-center justify-between gap-3">
            <span className="min-w-0 truncate text-base leading-tight text-muted-foreground">
              #{formatOrderId(order)} | {formatOrderDate(order.date)}
            </span>
            <Badge
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                order.completed
                  ? "border-transparent bg-emerald-100 text-emerald-700"
                  : "border-transparent bg-amber-100 text-amber-700",
              )}
            >
              {getOrderCompletedLabel(order.completed, t)}
            </Badge>
          </span>
          <span className="mt-2 block break-words text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground/80">{t("orders.workspace.phoneLabel")}</span> {senderPhone}
          </span>
          <span className="mt-1 block line-clamp-3 break-words text-sm leading-relaxed text-muted-foreground">
            {senderAddressLine}
          </span>
          <span className="mt-2 block line-clamp-2 text-sm leading-relaxed text-foreground/80">
            {comments || dash}
          </span>
        </button>
      </div>
      <div className={cn("mt-5 flex justify-end gap-2", selectionMode && "hidden")}>
        <Button
          type="button"
          variant="outline"
          className={cn("h-11 rounded-xl", tableSelectionActionStyles.edit)}
          disabled={!canEdit}
          onClick={() => onEdit(order)}
        >
          <Edit className="size-4" />
          {t("common.actions.edit")}
        </Button>
        {canRetryLegacySync && order.legacySyncStatus === "failed" ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl text-amber-700"
            onClick={() => onRetryLegacySync(order)}
            disabled={retryingLegacySync}
            aria-label={t("orders.actions.retryLegacySync")}
            title={order.legacySyncError || t("orders.actions.retryLegacySync")}
          >
            <RefreshCw className={cn("size-4", retryingLegacySync && "animate-spin")} />
            {t("orders.actions.sync")}
          </Button>
        ) : null}
        {canDelete ? <Button
          type="button"
          variant="outline"
          className={cn("h-11 rounded-xl", tableSelectionActionStyles.delete)}
          onClick={() => onDelete(order)}
        >
          <Trash2 className="size-4" />
          {t("common.actions.delete")}
        </Button> : null}
      </div>
    </article>
  );
}

const defaultFilters: OrderFilterState = {
  query: "",
  rows: [],
};

export function OrdersWorkspace({ routeMode = false }: { routeMode?: boolean } = {}) {
  const routeAccess = useRouteAppointmentsAccess();
  const { t } = useTranslation();
  const tabScope = useWorkspaceTabScope();
  const listActive = tabScope?.isActive ?? true;
  const { notifyUpdated, notifyDeleted, notifySuccess, notifyError } = useFeedback();
  const { loading: authLoading, companyId, hasPermission } = useAuth();
  const [filters, setFilters] = useState<OrderFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_ORDER_LIST_PARAMS.sort, () => setPage(1));
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const emptyOrderFormValues = useMemo(() => createEmptyOrderForm(), []);
  const editingOrderFormValues = useMemo(
    () => (editingOrder ? orderToFormValues(editingOrder) : null),
    [editingOrder],
  );
  const [deleteTarget, setDeleteTarget] = useState<Order | Order[] | null>(null);
  const [assignRouteOpen, setAssignRouteOpen] = useState(false);
  const [clearRouteOpen, setClearRouteOpen] = useState(false);
  const [completionConfirm, setCompletionConfirm] = useState<boolean | null>(null);
  /** When set, completion / route dialogs act on these orders instead of table selection. */
  const [bulkActionOrders, setBulkActionOrders] = useState<Order[] | null>(null);
  const listParams = useMemo(
    () =>
      buildOrderListParams({
        page,
        limit: pageLimit,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useOrders(listParams, { routeMode, enabled: !routeMode || routeAccess.canView });
  const { data: usersData, isLoading: usersLoading } = useUsers({
    page: 1,
    limit: 100,
    sort: "name:asc",
  }, { enabled: !routeMode });
  const { data: branchesData, isLoading: branchesLoading } = useBranchPicker(200, {
    enabled: filtersOpen,
  });

  const stats = useOrderStats({ enabled: !routeMode });
  const createOrderMutation = useCreateOrder();
  const updateOrderMutation = useUpdateOrder();
  const deleteOrdersMutation = useDeleteOrders();
  const setOrdersCompletedMutation = useSetOrdersCompleted();
  const retryLegacySyncMutation = useRetryOrderLegacySync();
  const clearRouteMutation = useClearOrdersRouteAssignments();
  const generatePickupReportMutation = useGeneratePickupReport();
  const duplicateConfirmation = useDuplicatePendingAppointmentConfirmation(!routeMode);
  const appointmentInvoice = useCreateAppointmentInvoice(routeMode ? "/route-appointments" : "/appointments");
  const pickupRouteLookup = useActiveRouteLookup("pickup", 500, { enabled: !routeMode });
  const predefinedRouteFilter = usePredefinedRouteFilterOptions(
    filtersOpen || filters.rows.some((row) => row.field === PREDEFINED_ROUTE_FILTER_FIELD && row.value.trim()),
  );
  const orderFilterFields = useOrderFilterFields();
  const advancedFilterFields = orderFilterFields.filter((field) => field.field !== PREDEFINED_ROUTE_FILTER_FIELD);
  const advancedRows = filters.rows.filter((row) => row.field !== PREDEFINED_ROUTE_FILTER_FIELD);
  const selectedPredefinedRoute = filters.rows.find((row) => row.field === PREDEFINED_ROUTE_FILTER_FIELD)?.value ?? "";
  const canRetryLegacySync = !routeMode || hasPermission(PERMISSIONS.pickupsSyncLegacy.name, PERMISSIONS.pickupsSyncLegacy.resourceType);
  const canCreatePredefinedRoute = !routeMode && hasPermission(PERMISSIONS.predefinedRoutesCreate.name, PERMISSIONS.predefinedRoutesCreate.resourceType);
  function selectPredefinedRoute(value: string) {
    setFilters((current) => ({ ...current, rows: [
      ...current.rows.filter((row) => row.field !== PREDEFINED_ROUTE_FILTER_FIELD),
      ...(value ? [{ id: "predefined-route", join: "and" as const, field: PREDEFINED_ROUTE_FILTER_FIELD, operator: "eq", value }] : []),
    ] }));
    setPage(1);
  }
  function changeAdvancedRows(rows: typeof filters.rows) {
    setFilters((current) => ({ ...current, rows: [...rows, ...current.rows.filter((row) => row.field === PREDEFINED_ROUTE_FILTER_FIELD)] }));
    setPage(1);
  }
  const predefinedRouteCreate = usePredefinedRouteWorkspace((route) => selectPredefinedRoute(String(route.id)));
  const predefinedRouteRow = predefinedRouteFilter.canView ? (
    <PredefinedRouteFilterRow
      value={selectedPredefinedRoute}
      options={predefinedRouteFilter.options}
      loading={predefinedRouteFilter.isLoading}
      error={predefinedRouteFilter.isError ? normalizeApiError(predefinedRouteFilter.error).message : undefined}
      canCreate={canCreatePredefinedRoute}
      onChange={selectPredefinedRoute}
      onAdd={() => { setFiltersOpen(false); predefinedRouteCreate.edit(null); }}
      onRetry={() => void predefinedRouteFilter.refetch()}
    />
  ) : null;
  const orders = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const totalOrders = data?.total ?? 0;
  rememberTotal(totalOrders);
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    orders.length > 0 && orders.every((order) => selectedIds.includes(getOrderRecordId(order)));
  const isSaving =
    createOrderMutation.isPending ||
    updateOrderMutation.isPending ||
    deleteOrdersMutation.isPending ||
    setOrdersCompletedMutation.isPending ||
    retryLegacySyncMutation.isPending ||
    duplicateConfirmation.isConfirming ||
    clearRouteMutation.isPending;
  const isPrinting = generatePickupReportMutation.isPending;

  useTableSelectionReset(
    buildTableSelectionResetKey(debouncedQuery, filters.rows),
    setSelectedIds,
  );

  useEffect(() => {
    if (!listActive) return;

    const context = readOrdersListContext();
    if (!context) return;

    clearOrdersListContext();
    setFilters(context.filters);
    setPage(1);
    if (context.openFilters) {
      setFiltersOpen(true);
    }
  }, [listActive, setPage, tabScope?.tabId]);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(getOrderRecordId(order))),
    [orders, selectedIds],
  );
  const selectedCount = selectedOrders.length;
  /** Uniform selection → offer the opposite status; mixed → manage both. */
  const selectedCompletionState = useMemo(() => {
    if (selectedOrders.length === 0) return null;
    const completedCount = selectedOrders.filter((order) => order.completed).length;
    if (completedCount === 0) return "incomplete" as const;
    if (completedCount === selectedOrders.length) return "complete" as const;
    return "mixed" as const;
  }, [selectedOrders]);
  const actionOrders = bulkActionOrders ?? selectedOrders;
  const selectedOrdersWithRoute = useMemo(
    () => selectedOrders.filter((order) => Boolean(order.routeId?.trim())),
    [selectedOrders],
  );
  const actionOrdersWithRoute = useMemo(
    () => actionOrders.filter((order) => Boolean(order.routeId?.trim())),
    [actionOrders],
  );
  const selectedOrdersToUnassign = useMemo(
    () => selectedOrdersWithRoute.filter(order => !order.completed),
    [selectedOrdersWithRoute],
  );
  const actionOrdersToUnassign = useMemo(
    () => actionOrdersWithRoute.filter((order) => !order.completed),
    [actionOrdersWithRoute],
  );
  const assignRouteOptions = useMemo(
    () => buildActiveRouteAssignmentOptions(pickupRouteLookup.items, t),
    [pickupRouteLookup.items, t],
  );
  const assignRoutesLoading = pickupRouteLookup.isLoading;
  const rawListErrorMessage = isError ? normalizeApiError(error).message : null;
  const listErrorMessage = rawListErrorMessage?.includes(PICKUP_ACCESS_UNAVAILABLE_PREFIX)
    ? t("orders.errors.pickupAccessUnavailable")
    : rawListErrorMessage;
  const missingCompanyContext = !authLoading && !companyId;

  const userFilterOptions = useMemo(
    () => buildOrderCreatedByFilterOptions(usersData?.items ?? []),
    [usersData?.items],
  );
  const branchFilterOptionsById = useMemo(
    () =>
      (branchesData?.items ?? []).map((branch) => ({
        value: String(branch.id),
        label: formatBranchFilterLabel(branch),
      })),
    [branchesData?.items],
  );
  const branchFilterOptionsByCode = useMemo(
    () =>
      (branchesData?.items ?? []).map((branch) => ({
        value: branch.code,
        label: formatBranchFilterLabel(branch),
      })),
    [branchesData?.items],
  );

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...orders.map((order) => getOrderRecordId(order))])),
      );
      return;
    }

    setSelectedIds((current) =>
      current.filter((id) => !orders.some((order) => getOrderRecordId(order) === id)),
    );
  }

  function toggleSelect(orderId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, orderId]))
        : current.filter((entry) => entry !== orderId),
    );
  }

  const { openFormTab, openTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (routeMode) return;
    if (isDesktopTabs) {
      openFormTab({ feature: "orders", baseHref: "/appointments", mode: "add", label: t("orders.actions.add") });
      return;
    }
    setEditingOrder(null);
    setFormMode("add");
  }

  function openEditForm(order: Order) {
    if (routeMode && !routeAccess.canUpdate) return;
    if (isDesktopTabs) {
      setViewOrder(null);
      openFormTab({
        feature: "orders",
        baseHref: routeMode ? "/route-appointments" : "/appointments",
        mode: "edit",
        entityId: getOrderRecordId(order),
        label: t("orders.actions.editNamed", { name: formatOrderId(order) }),
      });
      return;
    }
    setEditingOrder(order);
    setFormMode("edit");
    setViewOrder(null);
  }

  function openViewOrder(order: Order) {
    setViewOrder(order);
  }

  function createInvoiceFromOrder(order: Order) {
    setViewOrder(null);
    appointmentInvoice.startInvoice(order);
  }

  async function saveOrder(values: OrderFormValues) {
    if (routeMode && (!routeAccess.canUpdate || formMode !== "edit")) {
      return { error: t("shell.accessDenied.description") };
    }
    try {
      if (formMode === "edit" && editingOrder) {
        if (areOrderFormValuesEquivalent(values, orderToFormValues(editingOrder))) {
          notifySuccess(t("common.form.noChanges"));
          setFormMode(null);
          setEditingOrder(null);
          return { error: null };
        }

        const nextOrder = await updateOrderMutation.mutateAsync({
          orderId: getOrderRecordId(editingOrder),
          values,
        });
        notifyUpdated(t("orders.entity"), formatOrderId(nextOrder));
      } else {
        const nextOrder = await duplicateConfirmation.submit(values, (formValues, options) =>
          createOrderMutation.mutateAsync({ values: formValues, options }),
        );
        if (!nextOrder) return { error: null, cancelled: true };
        notifySuccess(t("orders.toasts.addedFor", { name: getOrderFeedbackName(nextOrder) }));
      }

      setFormMode(null);
      setEditingOrder(null);
      setPage(1);
      return { error: null };
    } catch (mutationError) {
      if (mutationError instanceof DuplicatePendingAppointmentCancelledError) {
        return { error: null, cancelled: true };
      }
      const message = normalizeApiError(mutationError).message;
      notifyError(message);
      return { error: message };
    }
  }

  async function confirmDelete() {
    if (routeMode) return;
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((order) => getOrderRecordId(order))
      : [getOrderRecordId(deleteTarget)];

    try {
      const result = await deleteOrdersMutation.mutateAsync(ids);

      reportBulkSettled({
        result,
        t,
        entityLabel: t("orders.entity"),
        notifyDeleted,
        notifyError,
        onAllFailed: (message) => {
          notifyError(message);
        },
        onDone: () => {
          setSelectedIds((current) => current.filter((id) => !result.succeededIds.includes(id)));
          setDeleteTarget(null);
          setViewOrder(null);
        },
      });
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  async function handleSetCompleted(completed: boolean) {
    if (routeMode && !routeAccess.canUpdate) return;
    if (actionOrders.length === 0) return;

    const affectedCount = actionOrders.length;

    try {
      const result = await setOrdersCompletedMutation.mutateAsync({
        orders: actionOrders,
        completed,
      });

      reportBulkSettled({
        result,
        total: affectedCount,
        t,
        notifyError,
        onSucceeded: (count) => {
          notifySuccess(
            count === 1
              ? t(completed ? "orders.toasts.markedComplete" : "orders.toasts.markedIncomplete", {
                  count,
                })
              : t(
                  completed
                    ? "orders.toasts.markedComplete_plural"
                    : "orders.toasts.markedIncomplete_plural",
                  { count },
                ),
          );
        },
        onAllFailed: (message) => {
          notifyError(message);
          setCompletionConfirm(null);
          setBulkActionOrders(null);
        },
        onDone: () => {
          setSelectedIds((current) =>
            current.filter((id) => !result.succeededIds.includes(id)),
          );
          if (
            viewOrder &&
            result.succeededIds.includes(getOrderRecordId(viewOrder))
          ) {
            setViewOrder((current) =>
              current ? { ...current, completed } : current,
            );
          }
          setCompletionConfirm(null);
          setBulkActionOrders(null);
        },
      });
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
      setCompletionConfirm(null);
      setBulkActionOrders(null);
    }
  }

  function openCompletionConfirm(completed: boolean, orders?: Order[]) {
    const targets = orders ?? selectedOrders;
    if (targets.length === 0) return;
    setBulkActionOrders(orders ?? null);
    setCompletionConfirm(completed);
  }

  function openAssignRoute(orders?: Order[]) {
    if (routeMode) return;
    const targets = orders ?? selectedOrders;
    if (targets.length === 0) return;
    setBulkActionOrders(orders ?? null);
    // Close the view sheet first — nested Sheet + Dialog both use dismiss layers,
    // and opening Assign route from the sheet Actions menu otherwise flashes closed.
    setViewOrder(null);
    // Defer past the DropdownMenu pointer-up / focus-restore so that event does not
    // light-dismiss the dialog the same tick it mounts (CompactActionDialog also
    // skips open autofocus, which makes the race easier to hit).
    window.setTimeout(() => setAssignRouteOpen(true), 0);
  }

  function openMapView(orders?: Order[]) {
    const targets = orders ?? selectedOrders;
    const mappableSelected = targets.filter(isOrderMappable);
    if (mappableSelected.length === 0) {
      notifyError(t("orders.map.noMappableStops"));
      return;
    }

    writeOrdersMapContext({
      filters,
      sort,
      selectedIds: mappableSelected.map((order) => getOrderRecordId(order)),
    });
    openTab(routeMode ? "/route-appointments/map" : "/appointments/map", t("orders.map.title"));
  }

  function viewSelectedRoute(order?: Order) {
    const targets = order
      ? [order].filter((entry) => Boolean(entry.routeId?.trim()))
      : selectedOrdersWithRoute;
    const routeIds = new Set(targets.map((entry) => entry.routeId!.trim()));
    if (routeIds.size === 0) {
      notifyError(t("orders.actions.noAssignedRoute"));
      return;
    }
    if (routeIds.size > 1) {
      notifyError(t("orders.actions.viewRouteMultiple"));
      return;
    }

    setViewOrder(null);
    setFilters({ query: "", rows: buildPickupRouteFilterRows([...routeIds][0]) });
    setPage(1);
    setFiltersOpen(true);
  }

  function openClearRoute(orders?: Order[]) {
    if (routeMode) return;
    const targets = (orders ?? selectedOrders).filter(
      (order) => Boolean(order.routeId?.trim()) && !order.completed,
    );
    if (targets.length === 0) {
      notifyError(t("orders.actions.noAssignedRoute"));
      return;
    }
    setBulkActionOrders(orders ?? null);
    setClearRouteOpen(true);
  }

  async function confirmClearRoute() {
    if (routeMode) return;
    if (actionOrdersToUnassign.length === 0) return;

    console.info("[clearPickupRoute] UI confirm", {
      count: actionOrdersToUnassign.length,
      orders: actionOrdersToUnassign.map((order) => ({
        id: order.id,
        routeId: order.routeId ?? null,
        routeName: order.routeName ?? null,
        senderName: order.sender?.name ?? null,
      })),
    });

    try {
      const result = await clearRouteMutation.mutateAsync(actionOrdersToUnassign);

      reportBulkSettled({
        result,
        t,
        notifyError,
        onSucceeded: (count) => {
          notifySuccess(
            count === 1
              ? t("orders.toasts.routeCleared", { count })
              : t("orders.toasts.routeCleared_plural", { count }),
          );
        },
        onAllFailed: (message) => {
          notifyError(message);
        },
        onDone: () => {
          setClearRouteOpen(false);
          setBulkActionOrders(null);
          setSelectedIds((current) =>
            current.filter((id) => !result.succeededIds.includes(id)),
          );
          if (
            viewOrder &&
            result.succeededIds.includes(getOrderRecordId(viewOrder))
          ) {
            setViewOrder((current) =>
              current
                ? { ...current, routeId: undefined, routeName: undefined }
                : current,
            );
          }
        },
      });
    } catch (mutationError) {
      console.error("[clearPickupRoute] UI error", mutationError);
      notifyError(normalizeApiError(mutationError).message);
      setBulkActionOrders(null);
    }
  }

  async function printOrders(orders: Order[]) {
    const pickupIds = orders.map((order) => getOrderRecordId(order)).filter(Boolean);
    if (pickupIds.length === 0) {
      notifyError(t("orders.actions.selectAtLeastOne"));
      return;
    }

    try {
      const report = await generatePickupReportMutation.mutateAsync({
        type: "pickup",
        collection: "pickups",
        values: pickupIds,
        lookupField: "id",
      });
      window.open(report.url, "_blank", "noopener,noreferrer");
      notifySuccess(
        pickupIds.length === 1
          ? t("orders.toasts.manifestReady", { count: pickupIds.length })
          : t("orders.toasts.manifestReady_plural", { count: pickupIds.length }),
      );
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
    }
  }

  function printSelectedOrders() {
    return printOrders(selectedOrders);
  }

  async function handleRetryLegacySync(order: Order) {
    if (!canRetryLegacySync) return;
    try {
      const syncedOrder = await retryLegacySyncMutation.mutateAsync(getOrderRecordId(order));
      notifySuccess(t("orders.toasts.legacyRetrySynced", { id: formatOrderId(syncedOrder) }));
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
    }
  }

  const tableColumns: DataTableColumn<Order>[] = useMemo(
    () => [
    {
      id: "id",
      label: t("orders.tableColumns.id"),
      sortField: "id",
      defaultWidth: 72,
      renderCell: (order) => formatOrderId(order),
    },
    {
      id: "date",
      label: t("orders.tableColumns.date"),
      defaultWidth: 112,
      renderCell: (order) => formatOrderCalendarDate(order.date),
    },
    {
      id: "completed",
      label: t("orders.tableColumns.completed"),
      truncateCell: false,
      defaultWidth: 88,
      renderCell: (order) => (
        <span
          className={cn(
            // Flat status label — bold color text (no pill chrome / icon).
            "font-semibold",
            order.completed ? "text-emerald-700" : "text-amber-700",
          )}
        >
          {getOrderCompletedLabel(order.completed, t)}
        </span>
      ),
    },
    {
      id: "createdAt",
      label: t("orders.tableColumns.createdAt"),
      defaultWidth: 112,
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatPickupTableDate(order.createdAt),
    },
    {
      id: "sender.phone",
      label: t("orders.tableColumns.senderPhone"),
      sortField: "sender.phone1",
      defaultWidth: 180,
      truncateCell: false,
      cellClassName: "align-top",
      renderCell: (order) => <CustomerTablePhoneCell customer={order.sender} />,
    },
    {
      id: "sender.name",
      label: t("orders.tableColumns.senderName"),
      sortField: "sender.name",
      defaultWidth: 180,
      cellClassName: "align-top font-medium",
      renderCell: (order) => order.sender.name.trim() || t("common.empty.dash"),
    },
    {
      id: "sender.address",
      label: t("orders.tableColumns.senderAddress"),
      sortField: "sender.address.address1",
      defaultWidth: 320,
      truncateCell: false,
      cellClassName: cn(ADDRESS_TEXT_WRAP_CLASSNAME, "align-top"),
      copyValue: (order) => {
        const primary = getPrimaryAddress(order.sender);
        if (!primary) return undefined;
        const line = [
          [primary.address1, primary.apartment].filter((part) => part?.trim()).join(" "),
          primary.address2,
        ]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(", ");
        return line || undefined;
      },
      renderCell: (order) => <OrderTableAddressCell customer={order.sender} />,
    },
    {
      id: "sender.city",
      label: t("orders.tableColumns.senderCity"),
      sortField: "sender.address.city",
      defaultWidth: 108,
      renderCell: (order) => formatAddressPart(order.sender, "city", t("common.empty.dash")),
    },
    {
      id: "sender.state",
      label: t("orders.columns.senderState"),
      sortField: "sender.address.state",
      defaultVisible: false,
      defaultWidth: 72,
      renderCell: (order) => formatAddressPart(order.sender, "state", t("common.empty.dash")),
    },
    {
      id: "sender.zip",
      label: t("orders.tableColumns.senderZip"),
      sortField: "sender.address.zipcode",
      defaultWidth: 104,
      renderCell: (order) => formatAddressPart(order.sender, "zipcode", t("common.empty.dash")),
    },
    {
      id: "sector.name",
      label: t("orders.tableColumns.sectorName"),
      sortField: "sector.name",
      defaultWidth: 96,
      renderCell: (order) => order.sector?.name.trim() || t("common.empty.dash"),
    },
    {
      id: "createdBy",
      label: t("orders.tableColumns.createdBy"),
      sortField: "createdBy.name",
      defaultWidth: 112,
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatUserSummary(order.createdBy),
    },
    {
      id: "updatedAt",
      label: t("orders.tableColumns.updatedAt"),
      defaultVisible: false,
      defaultWidth: 112,
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatPickupTableDate(order.updatedAt),
    },
    {
      id: "purpose",
      label: t("orders.columns.purpose"),
      sortField: "purpose",
      defaultVisible: false,
      defaultWidth: 160,
      copyValue: (order) => {
        const label = formatOrderPurposeLabel(order.purpose, t);
        return label === t("common.empty.dash") ? undefined : label;
      },
      renderCell: (order) => formatOrderPurposeLabel(order.purpose, t),
    },
    {
      id: "comments",
      label: t("orders.tableColumns.comments"),
      sortField: "comments.description",
      defaultWidth: 360,
      truncateCell: false,
      cellClassName: cn(ADDRESS_TEXT_WRAP_CLASSNAME, "align-top"),
      copyValue: (order) => {
        const summary = formatOrderCommentsSummary(order);
        return summary === "—" ? undefined : summary;
      },
      renderCell: (order) => <PickupCommentsCell order={order} />,
    },
    {
      id: "branch.code",
      label: t("orders.tableColumns.branchName"),
      sortField: "branch.code",
      defaultWidth: 92,
      cellClassName: "text-muted-foreground",
      renderCell: (order) => order.branch.code.trim() || t("common.empty.dash"),
    },
    {
      id: "employee.name",
      label: t("orders.tableColumns.employee"),
      sortField: "employee.name",
      defaultWidth: 120,
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatEmployeeSummary(order.employee),
    },
    {
      id: "route.name",
      label: t("orders.columns.route"),
      sortField: "route.name",
      defaultVisible: false,
      defaultWidth: 220,
      cellClassName: "text-muted-foreground",
      copyValue: (order) => {
        const label = formatOrderRouteName(order, pickupRouteLookup.getByKey(order.routeId), t);
        return label === "—" ? undefined : label;
      },
      renderCell: (order) =>
        formatOrderRouteName(order, pickupRouteLookup.getByKey(order.routeId), t),
    },
  ],
    [pickupRouteLookup, t],
  );

  // Bump storage key so prior 520px-capped widths are not reused after compact fit.
  const columnVisibility = useApiTableColumns("orders-v12-compact-fit", tableColumns, ORDER_API_TABLE_FIELDS);
  const activeFilterCount = countCompleteFilterRows(filters.rows, ORDER_TABLE_FILTER_FIELDS);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const isListFiltered = hasActiveFilters;
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: orders.length,
      page: currentPage,
      pageSize: pageLimit,
      total: totalOrders,
      noun: t("orders.noun"),
      isFiltered: isListFiltered,
      isLoading: isFetching,
    },
    t,
  );

  const selectionPrintButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void printSelectedOrders()}
      disabled={isPrinting}
      className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
    >
      <Printer className="h-4 w-4" />
      {isPrinting ? t("orders.actions.preparing") : t("orders.actions.print")}
    </Button>
  );

  const selectionSecondaryActions = (
    <TableSelectionActionsMenu disabled={isSaving}>
      {selectedCount === 1 && appointmentInvoice.canCreateInvoice ? (
        <DropdownMenuItem
          onSelect={() => createInvoiceFromOrder(selectedOrders[0])}
          className={tableSelectionActionMenuStyles.create}
        >
          <Receipt className="size-4" />
          {t("orders.actions.createInvoice")}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem onSelect={() => openMapView()} className={tableSelectionActionMenuStyles.map}>
        <MapIcon className="size-4" />
        {t("orders.actions.map")}
      </DropdownMenuItem>
      {selectedCompletionState === "incomplete" || selectedCompletionState === "mixed" ? (
        <DropdownMenuItem
          disabled={routeMode && !routeAccess.canUpdate}
          onSelect={() => openCompletionConfirm(true)}
          className={tableSelectionActionMenuStyles.complete}
        >
          <CheckCircle2 className="size-4" />
          {t("orders.actions.markComplete")}
        </DropdownMenuItem>
      ) : null}
      {selectedCompletionState === "complete" || selectedCompletionState === "mixed" ? (
        <DropdownMenuItem
          disabled={routeMode && !routeAccess.canUpdate}
          onSelect={() => openCompletionConfirm(false)}
          className={tableSelectionActionMenuStyles.caution}
        >
          <XCircle className="size-4" />
          {t("orders.actions.markIncomplete")}
        </DropdownMenuItem>
      ) : null}
      {!routeMode ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={routeMode && !routeAccess.canUpdate}
            onSelect={() => openAssignRoute()}
            className={tableSelectionActionMenuStyles.assign}
          >
            <RouteIcon className="size-4" />
            {t("orders.actions.assignRoute")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={selectedOrdersWithRoute.length === 0}
            onSelect={() => viewSelectedRoute()}
            className={tableSelectionActionMenuStyles.view}
          >
            <Eye className="size-4" />
            {t("orders.actions.viewRoute")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={selectedOrdersToUnassign.length === 0}
            onSelect={() => openClearRoute()}
            className={tableSelectionActionMenuStyles.caution}
          >
            <RouteOff className="size-4" />
            {clearRouteMutation.isPending
              ? t("orders.actions.clearingRoute")
              : t("orders.actions.clearRoute")}
          </DropdownMenuItem>
        </>
      ) : null}
    </TableSelectionActionsMenu>
  );

  const selectionToolbarActions = (
    <>
      {selectionPrintButton}
      {selectionSecondaryActions}
    </>
  );

  return (
    <>
    <PredefinedRouteDialog state={predefinedRouteCreate} />
    <div className="overflow-x-hidden">
      <section className="max-w-full space-y-5 overflow-x-hidden md:hidden">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
            <h1 className="text-4xl font-bold tracking-normal">{t(routeMode ? "navigation.items.routeAppointments" : "orders.title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{listSummary}</p>
            </div>
            {!routeMode ? <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="icon"
                className="mt-1 size-12 rounded-full"
                onClick={openAddForm}
                disabled={isSaving || (routeMode && !routeAccess.canUpdate)}
                aria-label={t("orders.actions.add")}
              >
                <Plus className="size-6" />
              </Button>
            </div> : null}
          </div>
        </div>

        <div className="rounded-3xl border bg-card p-4 shadow-sm">
          <div className="flex gap-3">
            <TableSearchInput isLoading={isFetching || isSearchPending}
              value={filters.query}
              onChange={(query) => {
                setFilters((current) => ({ ...current, query }));
                setPage(1);
              }}
              placeholder={t("orders.search.placeholder")}
              className="min-w-0 flex-1"
              inputClassName="h-12 rounded-2xl border-border bg-background text-base text-foreground shadow-none"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(
                "size-12 rounded-full bg-background",
                filtersOpen || activeFilterCount > 0 ? "bg-primary/10 text-primary" : "text-primary",
              )}
              onClick={() => setFiltersOpen((open) => !open)}
              aria-label={t("common.table.filters")}
            >
              <Filter className="size-5" />
            </Button>
          </div>

          {filtersOpen ? (
            <div className="mt-4">
              <TableFilterPanel isLoading={isFetching || isSearchPending}
                resultSummary={listSummary}
                presets={{
                  storageKey: "orders-mobile",
                  rows: filters.rows,
                  fields: orderFilterFields,
                  onApply: (rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  },
                }}
                onClearAll={
                  hasActiveFilters
                    ? () => {
                        setFilters(defaultFilters);
                        setPage(1);
                      }
                    : undefined
                }
              >
                <TableAdvancedFilterBuilder
                  open={filtersOpen}
                  rows={advancedRows}
                  fields={advancedFilterFields}
                  dynamicOptions={{
                    users: usersLoading ? [] : userFilterOptions,
                    pickupRoutes: assignRoutesLoading ? [] : assignRouteOptions,
                    predefinedRoutes: predefinedRouteFilter.isLoading ? [] : predefinedRouteFilter.options,
                    branches: branchesLoading ? [] : branchFilterOptionsById,
                    branchCodes: branchesLoading ? [] : branchFilterOptionsByCode,
                  }}
                  onChange={changeAdvancedRows}
                />
                {predefinedRouteRow}
              </TableFilterPanel>
            </div>
          ) : null}
        </div>

        {!isLoading && !listErrorMessage ? (
          <TablePaginationControls
            layout="mobile"
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            disabled={isLoading}
          />
        ) : null}

        {!isLoading && !listErrorMessage && orders.length > 0 && selectedCount > 0 ? (
          <TableSelectionToolbar
            selectedIds={selectedIds}
            pageRowIds={orders.map((order) => getOrderRecordId(order))}
            totalCount={totalOrders}
            onSelectedIdsChange={setSelectedIds}
            onEdit={() => { if (selectedOrders[0]) openEditForm(selectedOrders[0]); }}
            editDisabled={isSaving}
            onDelete={() => setDeleteTarget(selectedOrders)}
            canDelete={!routeMode}
            canEdit={!routeMode || routeAccess.canUpdate}
            deleteDisabled={isSaving}
            actions={selectionToolbarActions}
          />
        ) : null}

        {missingCompanyContext ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {t("orders.errors.missingCompanyContext")}
          </div>
        ) : null}

        {listErrorMessage ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {listErrorMessage}
          </div>
        ) : null}

        <div className="rounded-3xl bg-card px-4 shadow-sm">
          {isLoading ? (
            <div className="space-y-4 py-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="border-b border-border/80 py-3 last:border-b-0">
                  <div className="flex justify-between gap-4">
                    <div className="space-y-2">
                      <div className="h-5 w-28 rounded bg-muted" />
                      <div className="h-4 w-44 rounded bg-muted" />
                      <div className="h-4 w-36 rounded bg-muted" />
                    </div>
                    <div className="h-7 w-20 rounded-full bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters ? t("orders.empty.noMatch") : t("orders.empty.noneYet")}
              </p>
              {!routeMode ? <Button className="mt-4 h-11 rounded-xl" onClick={openAddForm}>
                <Plus className="size-4" />
                {t("orders.actions.add")}
              </Button> : null}
            </div>
          ) : (
            orders.map((order) => (
              <MobileOrderRow
                key={getOrderRecordId(order)}
                order={order}
                onView={openViewOrder}
                onEdit={openEditForm}
                onDelete={setDeleteTarget}
                canDelete={!routeMode}
                canEdit={!routeMode || routeAccess.canUpdate}
                canRetryLegacySync={canRetryLegacySync}
                onRetryLegacySync={handleRetryLegacySync}
                selected={selectedIds.includes(getOrderRecordId(order))}
                selectionMode={selectedCount > 0}
                retryingLegacySync={retryLegacySyncMutation.isPending}
                onToggleSelected={toggleSelect}
              />
            ))
          )}
        </div>
      </section>

      <div className="hidden md:block">
        <PageHeader
        title={t(routeMode ? "navigation.items.routeAppointments" : "orders.title")}
        description={t(routeMode ? "orders.pages.routeAppointments" : "orders.pages.description")}
        actions={
          <div className="flex items-center gap-2">
            {!routeMode ? (
              <DirectoryInsightsToggle open={insightsOpen} onOpenChange={setInsightsOpen} />
            ) : null}
            {!routeMode ? (
              <Button onClick={openAddForm} disabled={isSaving || (routeMode && !routeAccess.canUpdate)}>
                <Plus className="h-4 w-4" />
                {t("orders.actions.add")}
              </Button>
            ) : null}
          </div>
        }
      />

        <DirectoryInsightsFlip
          open={insightsOpen}
          onOpenChange={setInsightsOpen}
          className="mt-6"
          insights={
            routeMode ? undefined : (
              <AppointmentDirectoryInsights
                pendingTotal={stats.pending}
                pendingPickups={stats.pendingPickups}
                pendingTakes={stats.pendingTakes}
                pendingEstimates={stats.pendingEstimates}
                pendingPayments={stats.pendingPayments}
                isLoading={stats.isLoading}
                onBack={() => setInsightsOpen(false)}
              />
            )
          }
        >
        <Card className="gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            columnLayout={columnVisibility}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters((current) => ({ ...current, query }));
                  setPage(1);
                }}
                placeholder={t("orders.search.placeholder")}
              />
            }
            filterPanel={
              <TableFilterPanel isLoading={isFetching || isSearchPending}
                resultSummary={listSummary}
                presets={{
                  storageKey: "orders",
                  rows: filters.rows,
                  fields: orderFilterFields,
                  onApply: (rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  },
                }}
                onClearAll={
                  hasActiveFilters
                    ? () => {
                        setFilters(defaultFilters);
                        setPage(1);
                      }
                    : undefined
                }
              >
                <TableAdvancedFilterBuilder
                  open={filtersOpen}
                  rows={advancedRows}
                  fields={advancedFilterFields}
                  dynamicOptions={{
                    users: usersLoading ? [] : userFilterOptions,
                    pickupRoutes: assignRoutesLoading ? [] : assignRouteOptions,
                    predefinedRoutes: predefinedRouteFilter.isLoading ? [] : predefinedRouteFilter.options,
                    branches: branchesLoading ? [] : branchFilterOptionsById,
                    branchCodes: branchesLoading ? [] : branchFilterOptionsByCode,
                  }}
                  onChange={changeAdvancedRows}
                />
                {predefinedRouteRow}
              </TableFilterPanel>
            }
          />
        </CardHeader>

        {missingCompanyContext ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">
            {t("orders.errors.missingCompanyContext")}
          </div>
        ) : null}

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : null}

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={orders.map((order) => getOrderRecordId(order))}
          totalCount={totalOrders}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const order = orders.find((entry) => getOrderRecordId(entry) === selectedIds[0]);
            if (order) openEditForm(order);
          }}
          onDelete={() => setDeleteTarget(selectedOrders)}
          canDelete={!routeMode}
          canEdit={!routeMode || routeAccess.canUpdate}
          deleteDisabled={isSaving}
          actions={selectionToolbarActions}
        />

        {isLoading ? (
          <DirectoryTableLoader
            icon={PackageOpen}
            title={t("orders.loading.title")}
            description={t("orders.loading.description")}
            columns={t("orders.loading.columns").split(", ")}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={orders}
            page={currentPage}
            isPageDataPending={isFetching || isSearchPending}
            rowKey={(order) => getOrderRecordId(order)}
            rowLabel={(order) => formatOrderId(order)}
            columnLayout={columnVisibility}
            density="compact"
            minWidth={1500}
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            renderSelectCellActions={(order) =>
              canRetryLegacySync && order.legacySyncStatus === "failed" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300"
                  onClick={() => handleRetryLegacySync(order)}
                  disabled={retryLegacySyncMutation.isPending}
                  aria-label={t("orders.actions.retryLegacySync")}
                  title={order.legacySyncError || t("orders.actions.retryLegacySync")}
                >
                  <RefreshCw
                    className={cn("size-4", retryLegacySyncMutation.isPending && "animate-spin")}
                  />
                </Button>
              ) : null
            }
            onRowClick={openViewOrder}
            onRowDoubleClick={openEditForm}
            activeRowId={viewOrder ? getOrderRecordId(viewOrder) : undefined}
            emptyState={
              <>
                <p className="text-sm text-muted-foreground">
                  {hasActiveFilters ? t("orders.empty.noMatch") : t("orders.empty.noneYet")}
                </p>
                {!routeMode ? <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  {t("orders.actions.add")}
                </Button> : null}
              </>
            }
          />
        )}

        {!isLoading ? (
        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{listSummary}</p>
          </div>
          <TablePaginationControls
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            disabled={isLoading}
          />
        </div>
        ) : null}
        </Card>
        </DirectoryInsightsFlip>
      </div>

      <OrderViewSheet
        order={viewOrder}
        open={Boolean(viewOrder)}
        onOpenChange={(open) => {
          if (!open) setViewOrder(null);
        }}
        onEdit={openEditForm}
        canEdit={routeMode ? routeAccess.canUpdate : undefined}
        loadRouteDetails={!routeMode}
        onDelete={routeMode ? undefined : (order) => {
          setViewOrder(null);
          setDeleteTarget(order);
        }}
        onCreateInvoice={appointmentInvoice.canCreateInvoice ? createInvoiceFromOrder : undefined}
        onMap={(order) => openMapView([order])}
        onPrint={(order) => void printOrders([order])}
        isPrinting={isPrinting}
        onMarkComplete={(order) => openCompletionConfirm(true, [order])}
        onMarkIncomplete={(order) => openCompletionConfirm(false, [order])}
        canManageCompletion={!routeMode || routeAccess.canUpdate}
        onAssignRoute={routeMode ? undefined : (order) => openAssignRoute([order])}
        onViewRoute={routeMode ? undefined : (order) => viewSelectedRoute(order)}
        onClearRoute={routeMode ? undefined : (order) => openClearRoute([order])}
        canManageRoutes={!routeMode}
        actionsDisabled={isSaving}
      />

      <AppointmentInvoiceDialogs state={appointmentInvoice} />

      <Dialog
        open={formMode !== null}
        onOpenChange={(open) => {
          // Keep the appointment draft mounted while the duplicate confirmation
          // dialog is open (nested dismiss layers would otherwise wipe the form).
          if (!open && !duplicateConfirmation.isConfirming) {
            setFormMode(null);
          }
        }}
      >
        <DialogContent
          className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 max-md:[&>button.absolute]:hidden sm:h-auto sm:max-h-[90vh] sm:max-w-6xl sm:rounded-xl"
          onPointerDownOutside={(event) => {
            if (duplicateConfirmation.isConfirming) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (duplicateConfirmation.isConfirming) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (duplicateConfirmation.isConfirming) event.preventDefault();
          }}
        >
          <DialogHeader className="shrink-0 border-b border-primary/20 bg-primary px-4 pb-4 pt-5 text-primary-foreground sm:border-border sm:bg-background sm:px-6 sm:py-4 sm:text-foreground">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-2xl font-bold text-primary-foreground sm:text-lg sm:text-foreground">
                {formMode === "edit" ? t("orders.form.editTitle") : t("orders.form.addTitle")}
              </DialogTitle>
              <button
                type="button"
                className="font-semibold text-primary-foreground sm:hidden"
                disabled={duplicateConfirmation.isConfirming}
                onClick={() => {
                  if (duplicateConfirmation.isConfirming) return;
                  setFormMode(null);
                }}
              >
                {t("common.actions.cancel")}
              </button>
            </div>
            <DialogDescription className="text-primary-foreground/85 sm:hidden">
              {formMode === "edit" ? t("orders.actions.edit") : t("orders.form.addDescription")}
            </DialogDescription>
          </DialogHeader>
          <OrderForm
            key={editingOrder ? getOrderRecordId(editingOrder) : "new"}
            initialValues={
              formMode === "edit" && editingOrderFormValues
                ? editingOrderFormValues
                : emptyOrderFormValues
            }
            isEditing={formMode === "edit"}
            updatedAt={editingOrder?.updatedAt}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("orders.actions.add")}
            isSubmitting={isSaving}
            onSubmit={saveOrder}
            onCancel={() => {
              if (duplicateConfirmation.isConfirming) return;
              setFormMode(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <DuplicatePendingAppointmentDialog
        open={Boolean(duplicateConfirmation.pendingExisting)}
        existing={duplicateConfirmation.pendingExisting ?? []}
        onConfirm={() => duplicateConfirmation.respond(true)}
        onCancel={() => duplicateConfirmation.respond(false)}
      />

      <AssignAppointmentRouteDialog
        open={assignRouteOpen}
        onOpenChange={(open) => {
          setAssignRouteOpen(open);
          if (!open) setBulkActionOrders(null);
        }}
        appointments={actionOrders}
      />

      <Dialog
        open={completionConfirm !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCompletionConfirm(null);
            setBulkActionOrders(null);
          }
        }}
      >
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              {completionConfirm
                ? t("orders.dialogs.markCompleteTitle")
                : t("orders.dialogs.markIncompleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {actionOrders.length === 1
                ? t(
                    completionConfirm
                      ? "orders.dialogs.markCompleteDescription"
                      : "orders.dialogs.markIncompleteDescription",
                    { count: actionOrders.length },
                  )
                : t(
                    completionConfirm
                      ? "orders.dialogs.markCompleteDescription_plural"
                      : "orders.dialogs.markIncompleteDescription_plural",
                    { count: actionOrders.length },
                  )}
            </DialogDescription>
          </DialogHeader>
          {actionOrders.length > 0 ? (
            <ul
              role="list"
              className="max-h-56 divide-y divide-border overflow-y-auto overscroll-contain rounded-lg border border-border text-sm"
              aria-label={t("orders.dialogs.completionSummaryLabel")}
            >
              {actionOrders.map((order) => {
                const dash = t("common.empty.dash");
                const senderName = order.sender.name.trim() || dash;
                const streetLine = formatOrderSenderStreetLine(order, dash);
                const purpose = formatOrderPurposeLabel(order.purpose, t);
                return (
                  <li key={getOrderRecordId(order)} className="bg-muted/40 px-3 py-2.5">
                    <p className="truncate font-medium text-foreground">{senderName}</p>
                    <p className="mt-0.5 truncate text-muted-foreground">
                      <span className="sr-only">{t("orders.tableColumns.senderAddress")}: </span>
                      {streetLine}
                      <span aria-hidden="true"> · </span>
                      <span className="sr-only">{t("orders.columns.purpose")}: </span>
                      {purpose}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCompletionConfirm(null);
                setBulkActionOrders(null);
              }}
              disabled={setOrdersCompletedMutation.isPending}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              onClick={() => completionConfirm !== null && void handleSetCompleted(completionConfirm)}
              disabled={setOrdersCompletedMutation.isPending}
              className={
                completionConfirm
                  ? "bg-emerald-600 text-white hover:bg-emerald-600/90"
                  : "bg-amber-600 text-white hover:bg-amber-600/90"
              }
            >
              {completionConfirm ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {t("orders.actions.markComplete")}
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  {t("orders.actions.markIncomplete")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={clearRouteOpen}
        onOpenChange={(open) => {
          if (clearRouteMutation.isPending) return;
          setClearRouteOpen(open);
          if (!open) setBulkActionOrders(null);
        }}
      >
        <DialogContent
          className="z-[60]"
          onPointerDownOutside={(event) => {
            if (clearRouteMutation.isPending) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (clearRouteMutation.isPending) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("orders.dialogs.clearRouteTitle")}</DialogTitle>
            <DialogDescription>
              {actionOrdersToUnassign.length === 1
                ? t("orders.dialogs.clearRouteDescription", {
                    count: actionOrdersToUnassign.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("orders.dialogs.clearRouteDescription_plural", {
                    count: actionOrdersToUnassign.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setClearRouteOpen(false);
                setBulkActionOrders(null);
              }}
              disabled={clearRouteMutation.isPending}
            >
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton
              isPending={clearRouteMutation.isPending}
              onClick={() => void confirmClearRoute()}
              label={t("orders.actions.clearRoute")}
              pendingLabel={t("orders.actions.clearingRoute")}
              icon={RouteOff}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              {Array.isArray(deleteTarget) && deleteTarget.length > 1
                ? t("orders.dialogs.deleteTitlePlural")
                : t("orders.dialogs.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("orders.dialogs.deleteMany", {
                    count: deleteTarget.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("orders.dialogs.deleteOne", {
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton isPending={isSaving} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
    </>
  );
}
