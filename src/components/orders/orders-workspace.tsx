"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit,
  FileText,
  Filter,
  Map as MapIcon,
  PackageOpen,
  Plus,
  Printer,
  RefreshCw,
  Route as RouteIcon,
  RouteOff,
  Trash2,
  XCircle,
} from "lucide-react";

import { OrderForm } from "@/components/orders/order-form";
import { OrderViewSheet } from "@/components/orders/order-view-sheet";
import { AssignAppointmentRouteDialog } from "@/components/orders/assign-appointment-route-dialog";
import { CustomerTablePhoneCell } from "@/components/customers/customer-table-phone-cell";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { LegacyLastSynced } from "@/components/app-shell/legacy-last-synced";
import { TableTagText } from "@/components/app-shell/table-tag-text";
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
import { FlippableStatCard } from "@/components/app-shell/flippable-stat-card";
import { StatCardsCarousel } from "@/components/app-shell/stat-cards-carousel";
import { NewAppointmentsStatCard } from "@/components/orders/new-appointments-stat-card";

import {
  TableSelectionActionDivider,
  TableSelectionExpandableActionGroup,
} from "@/components/app-shell/table-selection-action-group";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
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
import { buildToolbarSearchSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDateTime } from "@/lib/audit/display";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  formatOrderCommentsSummary,
  formatOrderDate,
  formatOrderId,
  getOrderFeedbackName,
  formatOrderRouteName,
  formatUserSummary,
  buildOrderCreatedByFilterOptions,
  getOrderCompletedLabel,
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
  usePreviewLegacyPickupSync,
  useRetryOrderLegacySync,
  useSetOrdersCompleted,
  useSyncLegacyPickups,
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
import { useUsers } from "@/lib/users/hooks/use-users";
import { useGeneratePickupReport } from "@/lib/reports/hooks/use-reports";
import { useLegacyLastSynced } from "@/lib/legacy-sync/use-legacy-last-synced";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import {
  ADDRESS_TEXT_WRAP_CLASSNAME,
  formatAddressLine,
  getPrimaryAddress,
} from "@/lib/customers/utils/address-utils";
import type { Customer } from "@/lib/customers/types";
import { cn } from "@/lib/utils";
import type { DataTableColumn } from "@/lib/table/types";
import { useTranslation } from "@/lib/i18n";

const PICKUP_ACCESS_UNAVAILABLE_PREFIX = "Pickup access unavailable.";
const LEGACY_SYNC_PERMISSION_ERROR_NAMES = [
  "syncLegacyPickups",
  "canSyncLegacyPickups",
] as const;
const LEGACY_SYNC_FALLBACK_TOTAL = 1;

function LegacyPickupSyncLoader({
  current,
  total,
  title,
  description,
}: {
  current: number;
  total: number;
  title: string;
  description: string;
}) {
  return (
    <div
      className="relative overflow-hidden border-y bg-gradient-to-b from-primary/[0.06] via-background to-background px-6 py-8"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-primary to-transparent" />

      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4 grid h-16 w-16 place-items-center">
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
          <div className="absolute inset-0 rounded-full border border-primary/15" />
          <RefreshCw
            className="absolute inset-0 h-16 w-16 animate-spin text-primary drop-shadow-sm"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <div className="relative grid h-12 w-12 place-items-center rounded-full border border-primary/25 bg-card shadow-lg shadow-primary/10">
            <PackageOpen className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
        </div>

        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        <div className="mt-5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, (current / total) * 100))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function isLegacySyncPermissionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return LEGACY_SYNC_PERMISSION_ERROR_NAMES.some((name) =>
    normalized.includes(name.toLowerCase()),
  );
}

function formatStreetAndApt(customer: Customer, dash: string) {
  const primary = getPrimaryAddress(customer);
  if (!primary) return dash;

  const line = [primary.address1, primary.apartment]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  return line || dash;
}

function formatAddressPart(
  customer: Customer,
  part: "city" | "state" | "zipcode",
  dash: string,
) {
  const value = getPrimaryAddress(customer)?.[part]?.trim() ?? "";
  return value || dash;
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
  routeLabel,
  onView,
  onEdit,
  onDelete,
  onRetryLegacySync,
  selected,
  selectionMode,
  retryingLegacySync,
  onToggleSelected,
}: {
  order: Order;
  routeLabel: string;
  onView: (order: Order) => void;
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
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
          aria-label={selected ? "Deselect order" : "Select order"}
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
            <span className="font-semibold text-foreground/80">Phone:</span> {senderPhone}
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
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => onEdit(order)}>
          <Edit className="size-4" />
          {t("common.actions.edit")}
        </Button>
        {order.legacySyncStatus === "failed" ? (
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
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl text-destructive"
          onClick={() => onDelete(order)}
        >
          <Trash2 className="size-4" />
          {t("common.actions.delete")}
        </Button>
      </div>
    </article>
  );
}

const defaultFilters: OrderFilterState = {
  query: "",
  rows: [],
};

export function OrdersWorkspace() {
  const { t } = useTranslation();
  const tabScope = useWorkspaceTabScope();
  const listActive = tabScope?.isActive ?? true;
  const { notifyUpdated, notifyDeleted, notifySuccess, notifyError } = useFeedback();
  const { loading: authLoading, companyId, hasPermission } = useAuth();
  const canSyncLegacyPickups = hasPermission(
    PERMISSIONS.pickupsSyncLegacy.name,
    PERMISSIONS.pickupsSyncLegacy.resourceType,
  );
  const [filters, setFilters] = useState<OrderFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deferredQuery = useDeferredValue(filters.query);
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
  const [formError, setFormError] = useState<string | null>(null);
  const [assignRouteOpen, setAssignRouteOpen] = useState(false);
  const [clearRouteOpen, setClearRouteOpen] = useState(false);
  const [completionConfirm, setCompletionConfirm] = useState<boolean | null>(null);
  const [completionExpanded, setCompletionExpanded] = useState(false);
  const [routesExpanded, setRoutesExpanded] = useState(false);
  const [legacySyncStageIndex, setLegacySyncStageIndex] = useState<number | null>(null);
  const [legacySyncTotal, setLegacySyncTotal] = useState<number | null>(null);
  const legacySyncResetTimerRef = useRef<number | null>(null);
  const listParams = useMemo(
    () =>
      buildOrderListParams({
        page,
        limit: pageLimit,
        query: deferredQuery,
        rows: filters.rows,
        sort,
      }),
    [deferredQuery, filters.rows, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useOrders(listParams);
  const { data: usersData, isLoading: usersLoading } = useUsers({
    page: 1,
    limit: 100,
    sort: "name:asc",
  });
  const { data: branchesData, isLoading: branchesLoading } = useBranchPicker(200, {
    enabled: filtersOpen,
  });

  const stats = useOrderStats();
  const createOrderMutation = useCreateOrder();
  const updateOrderMutation = useUpdateOrder();
  const deleteOrdersMutation = useDeleteOrders();
  const setOrdersCompletedMutation = useSetOrdersCompleted();
  const previewLegacyPickupSyncMutation = usePreviewLegacyPickupSync();
  const syncLegacyPickupsMutation = useSyncLegacyPickups();
  const retryLegacySyncMutation = useRetryOrderLegacySync();
  const clearRouteMutation = useClearOrdersRouteAssignments();
  const generatePickupReportMutation = useGeneratePickupReport();
  const pickupRouteLookup = useActiveRouteLookup("pickup", 500);
  const orderFilterFields = useOrderFilterFields();
  const orders = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const legacyTimestamps = useMemo(
    () => orders.map((order) => order.legacySyncedAt),
    [orders],
  );
  const { lastSyncedAt, markSynced } = useLegacyLastSynced("pickups", {
    enabled: canSyncLegacyPickups,
    timestamps: legacyTimestamps,
  });
  const totalOrders = data?.total ?? 0;
  rememberTotal(totalOrders);
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    orders.length > 0 && orders.every((order) => selectedIds.includes(getOrderRecordId(order)));
  const isLegacySyncing =
    previewLegacyPickupSyncMutation.isPending ||
    syncLegacyPickupsMutation.isPending ||
    legacySyncStageIndex !== null;
  const isSaving =
    createOrderMutation.isPending ||
    updateOrderMutation.isPending ||
    deleteOrdersMutation.isPending ||
    setOrdersCompletedMutation.isPending ||
    isLegacySyncing ||
    retryLegacySyncMutation.isPending ||
    clearRouteMutation.isPending;
  const isPrinting = generatePickupReportMutation.isPending;

  useTableSelectionReset(
    buildTableSelectionResetKey(deferredQuery, filters.rows),
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
  }, [listActive, tabScope?.tabId]);

  useEffect(() => {
    if (!syncLegacyPickupsMutation.isPending) return;

    const timer = window.setInterval(() => {
      setLegacySyncStageIndex((current) => {
        const total = Math.max(LEGACY_SYNC_FALLBACK_TOTAL, legacySyncTotal ?? LEGACY_SYNC_FALLBACK_TOTAL);
        const maxIndex = Math.max(0, total - 1);
        const next = current == null ? 0 : current + 1;
        return Math.min(next, maxIndex);
      });
    }, 450);

    return () => window.clearInterval(timer);
  }, [legacySyncTotal, syncLegacyPickupsMutation.isPending]);

  useEffect(() => {
    return () => {
      if (legacySyncResetTimerRef.current != null) {
        window.clearTimeout(legacySyncResetTimerRef.current);
      }
    };
  }, []);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(getOrderRecordId(order))),
    [orders, selectedIds],
  );
  const selectedCount = selectedOrders.length;
  const selectedOrdersWithRoute = useMemo(
    () => selectedOrders.filter((order) => Boolean(order.routeId?.trim())),
    [selectedOrders],
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
    if (isDesktopTabs) {
      openFormTab({ feature: "orders", baseHref: "/appointments", mode: "add", label: t("orders.actions.add") });
      return;
    }
    setEditingOrder(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(order: Order) {
    if (isDesktopTabs) {
      setViewOrder(null);
      openFormTab({
        feature: "orders",
        baseHref: "/appointments",
        mode: "edit",
        entityId: getOrderRecordId(order),
        label: t("orders.actions.editNamed", { name: formatOrderId(order) }),
      });
      return;
    }
    setEditingOrder(order);
    setFormMode("edit");
    setViewOrder(null);
    setFormError(null);
  }

  function openViewOrder(order: Order) {
    setViewOrder(order);
  }

  async function saveOrder(values: OrderFormValues) {
    setFormError(null);

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
        const nextOrder = await createOrderMutation.mutateAsync(values);
        notifySuccess(t("orders.toasts.addedFor", { name: getOrderFeedbackName(nextOrder) }));
      }

      setFormMode(null);
      setEditingOrder(null);
      setPage(1);
      return { error: null };
    } catch (mutationError) {
      const message = normalizeApiError(mutationError).message;
      setFormError(message);
      return { error: message };
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((order) => getOrderRecordId(order))
      : [getOrderRecordId(deleteTarget)];

    try {
      await deleteOrdersMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewOrder(null);
      notifyDeleted(t("orders.entity"), ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  async function handleSetCompleted(completed: boolean) {
    if (selectedOrders.length === 0) return;

    const affectedIds = selectedOrders.map((order) => getOrderRecordId(order));
    const affectedCount = selectedOrders.length;

    try {
      await setOrdersCompletedMutation.mutateAsync({ orders: selectedOrders, completed });
      setSelectedIds((current) => current.filter((id) => !affectedIds.includes(id)));
      setCompletionConfirm(null);
      notifySuccess(
        affectedCount === 1
          ? t(completed ? "orders.toasts.markedComplete" : "orders.toasts.markedIncomplete", {
              count: affectedCount,
            })
          : t(completed ? "orders.toasts.markedComplete_plural" : "orders.toasts.markedIncomplete_plural", {
              count: affectedCount,
            }),
      );
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
      setCompletionConfirm(null);
    }
  }

  function openCompletionConfirm(completed: boolean) {
    if (selectedOrders.length === 0) return;
    setCompletionConfirm(completed);
  }

  function openAssignRoute() {
    if (selectedOrders.length === 0) return;
    setAssignRouteOpen(true);
  }

  function openMapView() {
    const mappableSelected = selectedOrders.filter(isOrderMappable);
    if (mappableSelected.length === 0) {
      notifyError(t("orders.map.noMappableStops"));
      return;
    }

    writeOrdersMapContext({
      filters,
      sort,
      selectedIds,
    });
    openTab("/appointments/map", t("orders.map.title"));
  }

  function openClearRoute() {
    if (selectedOrdersWithRoute.length === 0) {
      notifyError(t("orders.actions.noAssignedRoute"));
      return;
    }
    setClearRouteOpen(true);
  }

  async function confirmClearRoute() {
    if (selectedOrdersWithRoute.length === 0) return;

    console.info("[clearPickupRoute] UI confirm", {
      count: selectedOrdersWithRoute.length,
      orders: selectedOrdersWithRoute.map((order) => ({
        id: order.id,
        routeId: order.routeId ?? null,
        routeName: order.routeName ?? null,
        senderName: order.sender?.name ?? null,
      })),
    });

    try {
      const cleared = await clearRouteMutation.mutateAsync(selectedOrdersWithRoute);
      setClearRouteOpen(false);
      notifySuccess(
        cleared === 1
          ? t("orders.toasts.routeCleared", { count: cleared })
          : t("orders.toasts.routeCleared_plural", { count: cleared }),
      );
    } catch (mutationError) {
      console.error("[clearPickupRoute] UI error", mutationError);
      notifyError(normalizeApiError(mutationError).message);
      setClearRouteOpen(false);
    }
  }

  async function printSelectedOrders() {
    const pickupIds = selectedOrders.map((order) => getOrderRecordId(order)).filter(Boolean);
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

  async function handleSyncLegacyPickups() {
    if (legacySyncResetTimerRef.current != null) {
      window.clearTimeout(legacySyncResetTimerRef.current);
      legacySyncResetTimerRef.current = null;
    }

    setLegacySyncStageIndex(0);
    setLegacySyncTotal(null);
    try {
      try {
        const preview = await previewLegacyPickupSyncMutation.mutateAsync();
        setLegacySyncTotal(Math.max(0, preview.total));
      } catch {
        setLegacySyncTotal(LEGACY_SYNC_FALLBACK_TOTAL);
      }

      const result = await syncLegacyPickupsMutation.mutateAsync();
      const total =
        result.summary.total ||
        result.summary.imported + result.summary.updated + result.summary.skipped;
      const syncedCount = result.summary.imported + result.summary.updated;
      setLegacySyncTotal(Math.max(0, total));
      setLegacySyncStageIndex(Math.max(0, total - 1));
      markSynced(result.summary.lastSyncedAt);
      notifySuccess(
        syncedCount > 0
          ? t(
              syncedCount === 1
                ? "orders.toasts.legacySyncSynced"
                : "orders.toasts.legacySyncSynced_plural",
              {
                count: syncedCount,
                imported: result.summary.imported,
                updated: result.summary.updated,
              },
            )
          : result.message,
      );
      setPage(1);
    } catch (mutationError) {
      const message = normalizeApiError(mutationError).message;
      notifyError(
        isLegacySyncPermissionError(message)
          ? t("orders.errors.legacySyncPermissionMissing")
          : message,
      );
      setLegacySyncStageIndex(null);
      setLegacySyncTotal(null);
      return;
    }

    legacySyncResetTimerRef.current = window.setTimeout(() => {
      setLegacySyncStageIndex(null);
      setLegacySyncTotal(null);
      legacySyncResetTimerRef.current = null;
    }, 700);
  }

  async function handleRetryLegacySync(order: Order) {
    try {
      const syncedOrder = await retryLegacySyncMutation.mutateAsync(getOrderRecordId(order));
      notifySuccess(t("orders.toasts.legacyRetrySynced", { id: formatOrderId(syncedOrder) }));
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
    }
  }

  const statCards = [
    {
      label: t("orders.stats.pendingOrders.label"),
      value: stats.pending.toString(),
      icon: Clock,
    },
    {
      label: t("orders.stats.pendingPickups.label"),
      value: stats.pendingPickups.toString(),
      icon: PackageOpen,
    },
    {
      label: t("orders.stats.pendingTakes.label"),
      value: stats.pendingTakes.toString(),
      icon: ArrowDownToLine,
    },
    {
      label: t("orders.stats.pendingEstimates.label"),
      value: stats.pendingEstimates.toString(),
      icon: FileText,
    },
    {
      label: t("orders.stats.pendingPayments.label"),
      value: stats.pendingPayments.toString(),
      icon: DollarSign,
    },
  ];

  const tableColumns: DataTableColumn<Order>[] = useMemo(
    () => [
    {
      id: "completed",
      label: t("orders.columns.completed"),
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (order) => (
        <TableTagText
          className={
            order.completed
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-amber-700 dark:text-amber-300"
          }
        >
          {getOrderCompletedLabel(order.completed, t)}
        </TableTagText>
      ),
    },
    {
      id: "date",
      label: t("orders.columns.date"),
      renderCell: (order) => formatOrderDate(order.date),
    },
    {
      id: "sender.name",
      label: t("orders.columns.senderName"),
      cellClassName: "align-top font-medium",
      renderCell: (order) => order.sender.name.trim() || t("common.empty.dash"),
    },
    {
      id: "sender.phone",
      label: t("orders.columns.senderPhone"),
      sortField: "sender.phone1",
      truncateCell: false,
      cellClassName: cn(ADDRESS_TEXT_WRAP_CLASSNAME, "align-top"),
      renderCell: (order) => <CustomerTablePhoneCell customer={order.sender} />,
    },
    {
      id: "sender.address",
      label: t("orders.columns.senderAddress"),
      sortField: "sender.address.address1",
      defaultWidth: 180,
      truncateCell: false,
      cellClassName: cn(ADDRESS_TEXT_WRAP_CLASSNAME, "align-top"),
      renderCell: (order) => formatStreetAndApt(order.sender, t("common.empty.dash")),
    },
    {
      id: "sender.city",
      label: t("orders.columns.senderCity"),
      sortField: "sender.address.city",
      defaultWidth: 96,
      renderCell: (order) => formatAddressPart(order.sender, "city", t("common.empty.dash")),
    },
    {
      id: "sender.state",
      label: t("orders.columns.senderState"),
      sortField: "sender.address.state",
      defaultWidth: 64,
      renderCell: (order) => formatAddressPart(order.sender, "state", t("common.empty.dash")),
    },
    {
      id: "sender.zip",
      label: t("orders.columns.senderZip"),
      sortField: "sender.address.zipcode",
      defaultWidth: 72,
      renderCell: (order) => formatAddressPart(order.sender, "zipcode", t("common.empty.dash")),
    },
    {
      id: "comments",
      label: t("orders.columns.comments"),
      defaultWidth: 225,
      truncateCell: false,
      cellClassName: cn(ADDRESS_TEXT_WRAP_CLASSNAME, "align-top"),
      renderCell: (order) => <PickupCommentsCell order={order} />,
    },
    {
      id: "route.name",
      label: t("orders.columns.route"),
      sortField: "route.name",
      cellClassName: "text-muted-foreground",
      renderCell: (order) =>
        formatOrderRouteName(order, pickupRouteLookup.getByKey(order.routeId), t),
    },
    {
      id: "branch.code",
      label: t("orders.columns.branchName"),
      sortField: "branch.code",
      cellClassName: "text-muted-foreground",
      renderCell: (order) => order.branch.code.trim() || t("common.empty.dash"),
    },
    {
      id: "createdBy",
      label: t("orders.columns.createdBy"),
      sortField: "createdBy.name",
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatUserSummary(order.createdBy),
    },
    {
      id: "createdAt",
      label: t("orders.columns.createdAt"),
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatAuditDateTime(order.createdAt),
    },
    {
      id: "updatedAt",
      label: t("orders.columns.updatedAt"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatAuditDateTime(order.updatedAt),
    },
  ],
    [pickupRouteLookup, t],
  );

  const columnVisibility = useColumnVisibility("orders-v7", tableColumns);
  const activeFilterCount = countCompleteFilterRows(filters.rows, ORDER_TABLE_FILTER_FIELDS);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const isSearchPending = filters.query.trim() !== deferredQuery.trim();
  const isListFiltered = hasActiveFilters;
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: isListFiltered,
      query: filters.query,
      isSearchPending,
      matched: totalOrders,
      noun: t("orders.noun"),
      isLoading: isFetching && orders.length === 0,
    },
    t,
  );
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
  const legacySyncDisplayTotal = Math.max(
    LEGACY_SYNC_FALLBACK_TOTAL,
    legacySyncTotal ?? LEGACY_SYNC_FALLBACK_TOTAL,
  );
  const legacySyncCurrentStep = Math.min(
    legacySyncDisplayTotal,
    legacySyncTotal === 0 ? 0 : (legacySyncStageIndex ?? 0) + 1,
  );
  const legacySyncDescriptions = [
    t("orders.loading.legacySyncStages.prepare"),
    t("orders.loading.legacySyncStages.fetch"),
    t("orders.loading.legacySyncStages.apply"),
    t("orders.loading.legacySyncStages.refresh"),
  ];
  const legacySyncLoader = (
    <LegacyPickupSyncLoader
      current={legacySyncCurrentStep}
      total={legacySyncDisplayTotal}
      title={t("orders.loading.legacySyncProgress", {
        current: legacySyncCurrentStep,
        total: legacySyncTotal ?? legacySyncDisplayTotal,
      })}
      description={
        legacySyncDescriptions[
          Math.min(legacySyncDescriptions.length - 1, Math.max(0, legacySyncCurrentStep - 1))
        ] ?? legacySyncDescriptions[0]
      }
    />
  );

  return (
    <div className="overflow-x-hidden">
      <section className="max-w-full space-y-5 overflow-x-hidden md:hidden">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
            <h1 className="text-4xl font-bold tracking-normal">{t("orders.title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{listSummary}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canSyncLegacyPickups ? (
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="mt-1 size-12 rounded-full"
                  onClick={handleSyncLegacyPickups}
                  disabled={isSaving}
                  aria-label={t("orders.actions.syncLegacy")}
                  title={t("orders.actions.syncLegacy")}
                >
                  <RefreshCw
                    className={cn("size-5", isLegacySyncing && "animate-spin")}
                  />
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon"
                className="mt-1 size-12 rounded-full"
                onClick={openAddForm}
                disabled={isSaving}
                aria-label={t("orders.actions.add")}
              >
                <Plus className="size-6" />
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-card p-4 shadow-sm">
          <div className="flex gap-3">
            <TableSearchInput
              value={filters.query}
              onChange={(query) => {
                setFilters((current) => ({ ...current, query }));
                setPage(1);
              }}
              placeholder={t("orders.search.placeholder")}
              className="min-w-0 flex-1"
              inputClassName="h-12 rounded-2xl border-0 bg-blue-50 text-base shadow-none"
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
              <TableFilterPanel
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
                  rows={filters.rows}
                  fields={orderFilterFields}
                  dynamicOptions={{
                    users: usersLoading ? [] : userFilterOptions,
                    pickupRoutes: assignRoutesLoading ? [] : assignRouteOptions,
                    branches: branchesLoading ? [] : branchFilterOptionsById,
                    branchCodes: branchesLoading ? [] : branchFilterOptionsByCode,
                  }}
                  onChange={(rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  }}
                />
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
          <div className="rounded-xl border bg-card px-3 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">
                {selectedCount} selected
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => setSelectedIds([])}
              >
                Clear
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 rounded-lg px-2 text-xs leading-tight whitespace-normal"
                disabled={selectedCount !== 1}
                onClick={() => {
                  const order = selectedOrders[0];
                  if (order) openViewOrder(order);
                }}
              >
                <FileText className="size-4" />
                {t("common.actions.view")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 rounded-lg px-2 text-xs leading-tight whitespace-normal"
                disabled={selectedCount !== 1 || isSaving}
                onClick={() => {
                  const order = selectedOrders[0];
                  if (order) openEditForm(order);
                }}
              >
                <Edit className="size-4" />
                {t("common.actions.edit")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 rounded-lg px-2 text-xs leading-tight whitespace-normal"
                onClick={openMapView}
              >
                <MapIcon className="size-4" />
                {t("orders.actions.map")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-10 rounded-lg px-2 text-xs leading-tight whitespace-normal"
                onClick={printSelectedOrders}
                disabled={isPrinting}
              >
                <Printer className="size-4" />
                {isPrinting ? t("orders.actions.preparing") : t("orders.actions.print")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 rounded-lg bg-emerald-500/5 px-2 text-xs leading-tight text-emerald-700 whitespace-normal hover:bg-emerald-500/10 hover:text-emerald-700"
                disabled={isSaving}
                onClick={() => openCompletionConfirm(true)}
              >
                <CheckCircle2 className="size-4" />
                {t("orders.actions.markComplete")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 rounded-lg bg-amber-500/5 px-2 text-xs leading-tight text-amber-700 whitespace-normal hover:bg-amber-500/10 hover:text-amber-700"
                disabled={isSaving}
                onClick={() => openCompletionConfirm(false)}
              >
                <XCircle className="size-4" />
                {t("orders.actions.markIncomplete")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 rounded-lg px-2 text-xs leading-tight whitespace-normal"
                disabled={isSaving}
                onClick={openAssignRoute}
              >
                <RouteIcon className="size-4" />
                {t("orders.actions.assignRoute")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-10 rounded-lg bg-amber-500/5 px-2 text-xs leading-tight text-amber-700 whitespace-normal hover:bg-amber-500/10 hover:text-amber-700"
                disabled={isSaving || selectedOrdersWithRoute.length === 0}
                onClick={openClearRoute}
              >
                <RouteOff className="size-4" />
                {clearRouteMutation.isPending
                  ? t("orders.actions.clearingRoute")
                  : t("orders.actions.clearRoute")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-2 min-h-10 rounded-lg px-2 text-xs leading-tight text-destructive whitespace-normal hover:text-destructive"
                disabled={isSaving}
                onClick={() => setDeleteTarget(selectedOrders)}
              >
                <Trash2 className="size-4" />
                {t("common.actions.delete")}
              </Button>
            </div>
          </div>
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
          {isLegacySyncing ? (
            legacySyncLoader
          ) : isLoading ? (
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
              <p className="text-sm text-muted-foreground">{t("orders.empty.noMatch")}</p>
              <Button className="mt-4 h-11 rounded-xl" onClick={openAddForm}>
                <Plus className="size-4" />
                {t("orders.actions.add")}
              </Button>
            </div>
          ) : (
            orders.map((order) => (
              <MobileOrderRow
                key={getOrderRecordId(order)}
                order={order}
                routeLabel={formatOrderRouteName(order, pickupRouteLookup.getByKey(order.routeId), t)}
                onView={openViewOrder}
                onEdit={openEditForm}
                onDelete={setDeleteTarget}
                onRetryLegacySync={handleRetryLegacySync}
                selected={selectedIds.includes(getOrderRecordId(order))}
                selectionMode={selectedCount > 0}
                retryingLegacySync={retryLegacySyncMutation.isPending}
                onToggleSelected={toggleSelect}
              />
            ))
          )}
        </div>
        {canSyncLegacyPickups ? (
          <div className="px-1">
            <LegacyLastSynced at={lastSyncedAt} />
          </div>
        ) : null}
      </section>

      <div className="hidden md:block">
        <PageHeader
        title={t("orders.title")}
        description={t("orders.pages.description")}
        actions={
          <div className="flex items-center gap-2">
            {canSyncLegacyPickups ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleSyncLegacyPickups}
                disabled={isSaving}
              >
                <RefreshCw
                  className={cn("h-4 w-4", isLegacySyncing && "animate-spin")}
                />
                {isLegacySyncing
                  ? t("orders.actions.syncingLegacy")
                  : t("orders.actions.syncLegacy")}
              </Button>
            ) : null}
            <Button onClick={openAddForm} disabled={isSaving}>
              <Plus className="h-4 w-4" />
              {t("orders.actions.add")}
            </Button>
          </div>
        }
      />

        <StatCardsCarousel>
          {statCards.map((stat) => (
            <FlippableStatCard
              key={stat.label}
              label={stat.label}
              value={stats.isLoading ? "…" : stat.value}
              icon={stat.icon}
            />
          ))}
          <NewAppointmentsStatCard />
        </StatCardsCarousel>
        <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            columnLayout={columnVisibility}
            searchSummary={searchSummary}
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
              <TableFilterPanel
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
                  rows={filters.rows}
                  fields={orderFilterFields}
                  dynamicOptions={{
                    users: usersLoading ? [] : userFilterOptions,
                    pickupRoutes: assignRoutesLoading ? [] : assignRouteOptions,
                    branches: branchesLoading ? [] : branchFilterOptionsById,
                    branchCodes: branchesLoading ? [] : branchFilterOptionsByCode,
                  }}
                  onChange={(rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  }}
                />
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
          onView={() => {
            const order = orders.find((entry) => getOrderRecordId(entry) === selectedIds[0]);
            if (order) openViewOrder(order);
          }}
          onEdit={() => {
            const order = orders.find((entry) => getOrderRecordId(entry) === selectedIds[0]);
            if (order) openEditForm(order);
          }}
          onDelete={() => setDeleteTarget(selectedOrders)}
          deleteDisabled={isSaving}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={openMapView}>
                <MapIcon className="h-4 w-4" />
                {t("orders.actions.map")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={printSelectedOrders}
                disabled={isPrinting}
              >
                <Printer className="h-4 w-4" />
                {isPrinting ? t("orders.actions.preparing") : t("orders.actions.print")}
              </Button>
              <TableSelectionActionDivider />
              <TableSelectionExpandableActionGroup
                label={t("orders.actions.manageCompletion")}
                icon={CheckCircle2}
                expanded={completionExpanded}
                onExpandedChange={setCompletionExpanded}
                aria-label={t("orders.actions.completionGroup")}
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => openCompletionConfirm(true)}
                  className="bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-300"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t("orders.actions.markComplete")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => openCompletionConfirm(false)}
                  className="bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300"
                >
                  <XCircle className="h-4 w-4" />
                  {t("orders.actions.markIncomplete")}
                </Button>
              </TableSelectionExpandableActionGroup>
              <TableSelectionActionDivider />
              <TableSelectionExpandableActionGroup
                label={t("orders.actions.manageRoutes")}
                icon={RouteIcon}
                expanded={routesExpanded}
                onExpandedChange={setRoutesExpanded}
                aria-label={t("orders.actions.routeGroup")}
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSaving}
                  onClick={openAssignRoute}
                >
                  <RouteIcon className="h-4 w-4" />
                  {t("orders.actions.assignRoute")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSaving || selectedOrdersWithRoute.length === 0}
                  onClick={openClearRoute}
                  className="bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300"
                >
                  <RouteOff className="h-4 w-4" />
                  {clearRouteMutation.isPending
                    ? t("orders.actions.clearingRoute")
                    : t("orders.actions.clearRoute")}
                </Button>
              </TableSelectionExpandableActionGroup>
            </>
          }
        />

        {isLegacySyncing ? (
          legacySyncLoader
        ) : isLoading ? (
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
            isPageDataPending={isFetching}
            rowKey={(order) => getOrderRecordId(order)}
            rowLabel={(order) => formatOrderId(order)}
            columnLayout={columnVisibility}
            minWidth={1500}
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            renderSelectCellActions={(order) =>
              order.legacySyncStatus === "failed" ? (
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
                <p className="text-muted-foreground">{t("orders.empty.noMatch")}</p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  {t("orders.actions.add")}
                </Button>
              </>
            }
          />
        )}

        {!isLoading ? (
        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{listSummary}</p>
            {canSyncLegacyPickups ? <LegacyLastSynced at={lastSyncedAt} /> : null}
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
      </div>

      <OrderViewSheet
        order={viewOrder}
        open={Boolean(viewOrder)}
        onOpenChange={(open) => {
          if (!open) setViewOrder(null);
        }}
        onEdit={openEditForm}
        onDelete={(order) => {
          setViewOrder(null);
          setDeleteTarget(order);
        }}
      />

      <Dialog
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden rounded-none p-0 max-md:[&>button.absolute]:hidden sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-xl">
          <DialogHeader className="shrink-0 border-b border-primary/20 bg-primary px-4 pb-4 pt-5 text-primary-foreground sm:border-border sm:bg-background sm:px-6 sm:py-4 sm:text-foreground">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-2xl font-bold text-primary-foreground sm:text-lg sm:text-foreground">
                {formMode === "edit" ? t("orders.form.editTitle") : t("orders.form.addTitle")}
              </DialogTitle>
              <button
                type="button"
                className="font-semibold text-primary-foreground sm:hidden"
                onClick={() => {
                  setFormMode(null);
                  setFormError(null);
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
            onFormErrorChange={setFormError}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <AssignAppointmentRouteDialog
        open={assignRouteOpen}
        onOpenChange={setAssignRouteOpen}
        pickupIds={selectedOrders.map((order) => order.id)}
      />

      <Dialog
        open={completionConfirm !== null}
        onOpenChange={(open) => !open && setCompletionConfirm(null)}
      >
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              {completionConfirm
                ? t("orders.dialogs.markCompleteTitle")
                : t("orders.dialogs.markIncompleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {selectedOrders.length === 1
                ? t(
                    completionConfirm
                      ? "orders.dialogs.markCompleteDescription"
                      : "orders.dialogs.markIncompleteDescription",
                    { count: selectedOrders.length },
                  )
                : t(
                    completionConfirm
                      ? "orders.dialogs.markCompleteDescription_plural"
                      : "orders.dialogs.markIncompleteDescription_plural",
                    { count: selectedOrders.length },
                  )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompletionConfirm(null)}
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

      <Dialog open={clearRouteOpen} onOpenChange={setClearRouteOpen}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>{t("orders.dialogs.clearRouteTitle")}</DialogTitle>
            <DialogDescription>
              {selectedOrdersWithRoute.length === 1
                ? t("orders.dialogs.clearRouteDescription", {
                    count: selectedOrdersWithRoute.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("orders.dialogs.clearRouteDescription_plural", {
                    count: selectedOrdersWithRoute.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setClearRouteOpen(false)}
              disabled={clearRouteMutation.isPending}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmClearRoute()}
              disabled={clearRouteMutation.isPending}
            >
              <RouteOff className="h-4 w-4" />
              {t("orders.actions.clearRoute")}
            </Button>
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
  );
}
