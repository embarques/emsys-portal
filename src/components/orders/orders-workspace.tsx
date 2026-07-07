"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  FileText,
  Map as MapIcon,
  PackageOpen,
  Plus,
  Printer,
  Route as RouteIcon,
  Trash2,
  XCircle,
} from "lucide-react";

import { OrderForm } from "@/components/orders/order-form";
import { OrderViewSheet } from "@/components/orders/order-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
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
  formatOrderRouteName,
  buildOrderCreatedByFilterOptions,
  getCustomerPhone,
  getOrderBranchLabel,
  getOrderCompletedLabel,
} from "@/lib/orders/display";
import { buildRouteFilterOptions } from "@/lib/route-manager/display";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import { useActiveRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import {
  useCreateOrder,
  useDeleteOrders,
  useOrderStats,
  useOrders,
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
} from "@/lib/orders/types";
import { useUsers } from "@/lib/users/hooks/use-users";
import {
  useAssignPickupsToRoute,
  useRouteLookup,
} from "@/lib/route-manager/hooks/use-route-manager";
import { useGeneratePickupReport } from "@/lib/reports/hooks/use-reports";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Label } from "@/components/ui/label";
import { useTableSort } from "@/lib/table/use-table-sort";
import { getCustomerPrimaryCoreAddress } from "@/lib/customers/types";
import type { DataTableColumn } from "@/lib/table/types";
import { useTranslation } from "@/lib/i18n";

const PAGE_SIZE = DEFAULT_ORDER_LIST_PARAMS.limit;

const defaultFilters: OrderFilterState = {
  query: "",
  rows: [],
};

export function OrdersWorkspace() {
  const { t } = useTranslation();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess, notifyError } = useFeedback();
  const { loading: authLoading, companyId } = useAuth();
  const [filters, setFilters] = useState<OrderFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_ORDER_LIST_PARAMS.sort, () => setPage(1));
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | Order[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [assignRouteOpen, setAssignRouteOpen] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const listParams = useMemo(
    () =>
      buildOrderListParams({
        page,
        limit: PAGE_SIZE,
        query: deferredQuery,
        rows: filters.rows,
        sort,
      }),
    [deferredQuery, filters.rows, page, sort],
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
  const assignRouteMutation = useAssignPickupsToRoute();
  const generatePickupReportMutation = useGeneratePickupReport();
  const routeLookup = useRouteLookup();
  const orderFilterFields = useOrderFilterFields();
  const pickupRoutesQuery = useActiveRoutePicker("pickup", 200, { enabled: assignRouteOpen });
  const orders = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const totalOrders = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    orders.length > 0 && orders.every((order) => selectedIds.includes(getOrderRecordId(order)));
  const isSaving =
    createOrderMutation.isPending ||
    updateOrderMutation.isPending ||
    deleteOrdersMutation.isPending ||
    setOrdersCompletedMutation.isPending ||
    assignRouteMutation.isPending;
  const isPrinting = generatePickupReportMutation.isPending;

  useTableSelectionReset(
    buildTableSelectionResetKey(deferredQuery, filters.rows),
    setSelectedIds,
  );

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.includes(getOrderRecordId(order))),
    [orders, selectedIds],
  );
  const routes = routeLookup.items;
  const routeOptions = useMemo(() => buildRouteFilterOptions(routes), [routes]);
  const pickupRoutes = pickupRoutesQuery.data?.items ?? [];
  const assignRouteOptions = useMemo(
    () => buildActiveRouteAssignmentOptions(pickupRoutes),
    [pickupRoutes],
  );
  const routesLoading = routeLookup.isLoading;
  const assignRoutesLoading = pickupRoutesQuery.isLoading;
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
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
    setSelectedIds((current) => (checked ? [...current, orderId] : current.filter((entry) => entry !== orderId)));
  }

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({ feature: "orders", baseHref: "/orders", mode: "add", label: t("orders.actions.add") });
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
        baseHref: "/orders",
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

  async function saveOrder(values: OrderFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingOrder) {
        const nextOrder = await updateOrderMutation.mutateAsync({
          orderId: getOrderRecordId(editingOrder),
          values,
        });
        notifyUpdated(t("orders.entity"), formatOrderId(nextOrder));
      } else {
        const nextOrder = await createOrderMutation.mutateAsync(values);
        notifyAdded(t("orders.entity"), formatOrderId(nextOrder));
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

    try {
      await setOrdersCompletedMutation.mutateAsync({ orders: selectedOrders, completed });
      notifySuccess(
        selectedOrders.length === 1
          ? t(completed ? "orders.toasts.markedComplete" : "orders.toasts.markedIncomplete", {
              count: selectedOrders.length,
            })
          : t(completed ? "orders.toasts.markedComplete_plural" : "orders.toasts.markedIncomplete_plural", {
              count: selectedOrders.length,
            }),
      );
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
    }
  }

  function openAssignRoute() {
    if (selectedOrders.length === 0) return;
    setSelectedRouteId("");
    setAssignRouteOpen(true);
  }

  async function confirmAssignRoute() {
    if (selectedOrders.length === 0 || !selectedRouteId) return;

    const pickupIds = selectedOrders.map((order) => order.id);

    try {
      await assignRouteMutation.mutateAsync({ routeId: selectedRouteId, pickupIds });
      const routeName = pickupRoutes.find((route) => route.id === selectedRouteId)?.name;
      const routeSuffix = routeName
        ? t("orders.toasts.assignedToRouteNamed", { routeName })
        : "";
      notifySuccess(
        pickupIds.length === 1
          ? t("orders.toasts.assignedToRoute", { count: pickupIds.length, routeSuffix })
          : t("orders.toasts.assignedToRoute_plural", { count: pickupIds.length, routeSuffix }),
      );
      setAssignRouteOpen(false);
      setSelectedRouteId("");
    } catch (mutationError) {
      notifyError(normalizeApiError(mutationError).message);
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

  // TODO: implement map for selected orders.
  function handleComingSoon(label: string) {
    notifySuccess(t("orders.toasts.comingSoon", { label }));
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
      id: "branch.name",
      label: t("orders.columns.branchName"),
      sortField: "branch.name",
      cellClassName: "text-muted-foreground",
      renderCell: (order) => getOrderBranchLabel(order.branch) || t("common.empty.dash"),
    },
    {
      id: "createdAt",
      label: t("orders.columns.createdAt"),
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatAuditDateTime(order.createdAt),
    },
    {
      id: "sender.name",
      label: t("orders.columns.senderName"),
      cellClassName: "font-medium",
      renderCell: (order) => order.sender.name.trim() || t("common.empty.dash"),
    },
    {
      id: "sender.address",
      label: t("orders.columns.senderAddress"),
      sortField: "sender.address.address1",
      renderCell: (order) => {
        const address = getCustomerPrimaryCoreAddress(order.sender);
        return (
          [address.address1, address.apartment].filter((value) => value.trim()).join(", ") ||
          t("common.empty.dash")
        );
      },
    },
    {
      id: "sender.address.city",
      label: t("orders.columns.senderCity"),
      renderCell: (order) =>
        getCustomerPrimaryCoreAddress(order.sender).city.trim() || t("common.empty.dash"),
    },
    {
      id: "sender.address.zipcode",
      label: t("orders.columns.senderZip"),
      renderCell: (order) =>
        getCustomerPrimaryCoreAddress(order.sender).zipcode.trim() || t("common.empty.dash"),
    },
    {
      id: "sender.phone1",
      label: t("orders.columns.senderPhone1"),
      renderCell: (order) => getCustomerPhone(order.sender),
    },
    {
      id: "comments",
      label: t("orders.columns.comments"),
      renderCell: (order) => formatOrderCommentsSummary(order),
    },
    {
      id: "route.name",
      label: t("orders.columns.route"),
      sortField: "route.name",
      cellClassName: "text-muted-foreground",
      renderCell: (order) =>
        formatOrderRouteName(order, routeLookup.getByKey(order.routeId)),
    },
    {
      id: "updatedAt",
      label: t("orders.columns.updatedAt"),
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatAuditDateTime(order.updatedAt),
    },
  ],
    [routeLookup, t],
  );

  const columnVisibility = useColumnVisibility("orders-v3", tableColumns);
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
      pageSize: PAGE_SIZE,
      total: totalOrders,
      noun: t("orders.noun"),
      isFiltered: isListFiltered,
      isLoading: isFetching,
    },
    t,
  );

  return (
    <div>
      <PageHeader
        title={t("orders.title")}
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            {t("orders.actions.add")}
          </Button>
        }
      />

      <StatCards
        items={statCards.map((stat) => ({
          ...stat,
          value: stats.isLoading ? "…" : stat.value,
        }))}
      />

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
                    routes: routeOptions,
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
          onEdit={() => {
            const order = orders.find((entry) => getOrderRecordId(entry) === selectedIds[0]);
            if (order) openEditForm(order);
          }}
          onDelete={() => setDeleteTarget(selectedOrders)}
          deleteDisabled={isSaving}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={printSelectedOrders}
                disabled={isPrinting}
              >
                <Printer className="h-4 w-4" />
                {isPrinting ? t("orders.actions.preparing") : t("orders.actions.print")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={() => handleSetCompleted(true)}
                className="border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-300"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("orders.actions.markComplete")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isSaving}
                onClick={() => handleSetCompleted(false)}
                className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300"
              >
                <XCircle className="h-4 w-4" />
                {t("orders.actions.markIncomplete")}
              </Button>
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
                onClick={() => handleComingSoon(t("orders.actions.map"))}
              >
                <MapIcon className="h-4 w-4" />
                {t("orders.actions.map")}
              </Button>
            </>
          }
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
            onRowClick={setViewOrder}
            onRowDoubleClick={openEditForm}
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
          <p className="text-sm text-muted-foreground">{listSummary}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              {t("common.actions.previous")}
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              {t("common.pagination.pageOf", { current: currentPage, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              {t("common.actions.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        ) : null}
      </Card>

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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {formMode === "edit" ? t("orders.form.editTitle") : t("orders.form.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <OrderForm
            key={editingOrder ? getOrderRecordId(editingOrder) : "new"}
            initialValues={
              formMode === "edit" && editingOrder ? orderToFormValues(editingOrder) : createEmptyOrderForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingOrder?.updatedAt}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("orders.actions.add")}
            onSubmit={saveOrder}
            onFormErrorChange={setFormError}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={assignRouteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAssignRouteOpen(false);
            setSelectedRouteId("");
          }
        }}
      >
        <DialogContent
          className="z-[60]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t("orders.dialogs.assignRouteTitle")}</DialogTitle>
            <DialogDescription>
              {selectedOrders.length === 1
                ? t("orders.dialogs.assignRouteDescription", { count: selectedOrders.length })
                : t("orders.dialogs.assignRouteDescription_plural", { count: selectedOrders.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="assign-route">{t("orders.columns.route")}</Label>
            <SearchableSelect
              id="assign-route"
              value={selectedRouteId}
              onValueChange={setSelectedRouteId}
              placeholder={t("orders.dialogs.selectRoute")}
              searchPlaceholder={t("orders.dialogs.searchRoutes")}
              loading={assignRoutesLoading}
              emptyMessage={
                assignRoutesLoading
                  ? t("orders.dialogs.loadingRoutes")
                  : t("orders.dialogs.noRoutesFound")
              }
              options={assignRouteOptions}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignRouteOpen(false);
                setSelectedRouteId("");
              }}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={confirmAssignRoute} disabled={!selectedRouteId || isSaving}>
              <RouteIcon className="h-4 w-4" />
              {t("orders.actions.assignRoute")}
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
            <Button variant="destructive" onClick={confirmDelete} disabled={isSaving}>
              <Trash2 className="h-4 w-4" />
              {t("common.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
