"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  Package,
  Plus,
  Trash2,
} from "lucide-react";

import { OrderForm } from "@/components/orders/order-form";
import { OrderViewSheet } from "@/components/orders/order-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
  TableFilterSection,
} from "@/components/app-shell/table-directory-toolbar";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDate } from "@/lib/audit/display";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  formatCustomerPartySummary,
  formatEmployeeSummary,
  formatOrderCommentsSummary,
  formatOrderDate,
  formatOrderId,
  formatUserSummary,
  getOrderBranchLabel,
  getOrderCompletedLabel,
} from "@/lib/orders/display";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import {
  useCreateOrder,
  useDeleteOrders,
  useOrderStats,
  useOrders,
  useUpdateOrder,
} from "@/lib/orders/hooks/use-orders";
import {
  DEFAULT_ORDER_LIST_PARAMS,
  createEmptyOrderForm,
  createOrderSearchFilter,
  getOrderRecordId,
  orderToFormValues,
  type Order,
  type OrderFilterState,
  type OrderFormValues,
} from "@/lib/orders/types";
import type { DataTableColumn } from "@/lib/table/types";
import { getBranchBadgeClass } from "@/lib/trucks/display";

const PAGE_SIZE = DEFAULT_ORDER_LIST_PARAMS.limit;

const defaultFilters: OrderFilterState = {
  query: "",
  branch: "all",
  completed: "all",
};

export function OrdersWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const { loading: authLoading, companyId } = useAuth();
  const [filters, setFilters] = useState<OrderFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | Order[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const listParams = useMemo(() => {
    const search = createOrderSearchFilter(deferredQuery);

    return {
      ...DEFAULT_ORDER_LIST_PARAMS,
      page,
      limit: PAGE_SIZE,
      search,
      branch: filters.branch,
      completed: filters.completed,
    };
  }, [
    deferredQuery,
    filters.branch,
    filters.completed,
    page,
  ]);

  const { data, isLoading, isError, error, isFetching } = useOrders(listParams);
  const { data: branchesData, isLoading: branchesLoading } = useBranchPicker();

  const branchStatsIds = useMemo(() => {
    const items = branchesData?.items ?? [];
    const nyBranch = items.find((branch) => branch.code.trim().toUpperCase() === "NY");
    const drBranch = items.find((branch) => ["RD", "DR"].includes(branch.code.trim().toUpperCase()));

    return {
      usaBranchId: nyBranch?.id ?? items[0]?.id,
      drBranchId: drBranch?.id ?? items[1]?.id,
    };
  }, [branchesData?.items]);

  const stats = useOrderStats({ ...branchStatsIds, branchesReady: !branchesLoading });
  const createOrderMutation = useCreateOrder();
  const updateOrderMutation = useUpdateOrder();
  const deleteOrdersMutation = useDeleteOrders();
  const orders = data?.items ?? [];
  const totalOrders = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    orders.length > 0 && orders.every((order) => selectedIds.includes(getOrderRecordId(order)));
  const isSaving =
    createOrderMutation.isPending ||
    updateOrderMutation.isPending ||
    deleteOrdersMutation.isPending;
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const missingCompanyContext = !authLoading && !companyId;

  const branchFilters = useMemo(
    () => [
      { value: "all" as const, label: "All" },
      ...(branchesData?.items ?? []).map((branch) => ({
        value: branch.id,
        label: formatBranchFilterLabel(branch),
      })),
    ],
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

  function openAddForm() {
    setEditingOrder(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(order: Order) {
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
        notifyUpdated("Order", formatOrderId(nextOrder));
      } else {
        const nextOrder = await createOrderMutation.mutateAsync(values);
        notifyAdded("Order", formatOrderId(nextOrder));
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
      notifyDeleted("Order", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const statCards = [
    {
      label: "Total orders",
      value: stats.total.toString(),
      description: "Pickups from GET /pickups",
      icon: Package,
    },
    {
      label: "USA",
      value: stats.usa.toString(),
      description: "Branch NY",
      icon: MapPin,
    },
    {
      label: "DR",
      value: stats.dr.toString(),
      description: "Branch DR",
      icon: ClipboardList,
    },
  ];

  const completedFilters: { value: OrderFilterState["completed"]; label: string }[] = [
    { value: "all", label: "All statuses" },
    { value: false, label: "Pending" },
    { value: true, label: "Completed" },
  ];

  const tableColumns: DataTableColumn<Order>[] = [
    {
      id: "id",
      label: "Order ID",
      cellClassName: "font-mono text-xs",
      renderCell: (order) => (order.oldID > 0 ? order.oldID : order.id),
    },
    {
      id: "oldID",
      label: "oldID",
      cellClassName: "font-mono text-xs",
      renderCell: (order) => (order.oldID > 0 ? order.oldID : "—"),
    },
    {
      id: "date",
      label: "date",
      renderCell: (order) => formatOrderDate(order.date),
    },
    {
      id: "completed",
      label: "completed",
      renderCell: (order) => (
        <Badge
          variant="outline"
          className={
            order.completed
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
          }
        >
          {getOrderCompletedLabel(order.completed)}
        </Badge>
      ),
    },
    {
      id: "branch",
      label: "branch",
      renderCell: (order) => (
        <Badge className={getBranchBadgeClass(order.branch.code)}>{getOrderBranchLabel(order.branch)}</Badge>
      ),
    },
    {
      id: "sender",
      label: "sender",
      renderCell: (order) => formatCustomerPartySummary(order.sender),
    },
    {
      id: "receiver",
      label: "receiver",
      renderCell: (order) => (order.receiver ? order.receiver.name : "—"),
    },
    {
      id: "purpose",
      label: "purpose",
      renderCell: (order) => order.purpose || "—",
    },
    {
      id: "sector",
      label: "sector",
      renderCell: (order) => (order.sector ? `${order.sector.id} · ${order.sector.name}` : "—"),
    },
    {
      id: "employee",
      label: "employee",
      renderCell: (order) => formatEmployeeSummary(order.employee),
    },
    {
      id: "user",
      label: "user",
      renderCell: (order) => formatUserSummary(order.user),
    },
    {
      id: "comments",
      label: "comments",
      renderCell: (order) => formatOrderCommentsSummary(order),
    },
    {
      id: "createdAt",
      label: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatAuditDate(order.createdAt),
    },
    {
      id: "updatedAt",
      label: "updatedAt",
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatAuditDate(order.updatedAt),
    },
  ];

  const columnVisibility = useColumnVisibility("orders", tableColumns);
  const activeFilterCount =
    (filters.branch !== "all" ? 1 : 0) + (filters.completed !== "all" ? 1 : 0);
  const hasActiveFilters =
    Boolean(filters.query.trim()) || filters.branch !== "all" || filters.completed !== "all";

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Pickups from GET /pickups aligned to id, user, branch, employee, sender, receiver, purpose, comments, and sector."
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add order
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.isLoading ? "…" : stat.value}</div>
                <CardDescription className="mt-1">{stat.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
          <CardTitle>Order directory</CardTitle>

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
                placeholder="Search orders by sender..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${orders.length} of ${totalOrders} orders`}
                onClearAll={
                  hasActiveFilters
                    ? () => {
                        setFilters(defaultFilters);
                        setPage(1);
                      }
                    : undefined
                }
              >
            <TableFilterSection label="Branch">
              {branchesLoading ? (
                <span className="text-sm text-muted-foreground">Loading branches…</span>
              ) : (
                branchFilters.map((option) => (
                  <Button
                    key={String(option.value)}
                    type="button"
                    size="sm"
                    variant={filters.branch === option.value ? "default" : "outline"}
                    onClick={() => {
                      setFilters((current) => ({ ...current, branch: option.value }));
                      setPage(1);
                    }}
                  >
                    {option.label}
                  </Button>
                ))
              )}
            </TableFilterSection>

            <TableFilterSection label="Status">
              {completedFilters.map((option) => (
                <Button
                  key={String(option.value)}
                  type="button"
                  size="sm"
                  variant={filters.completed === option.value ? "default" : "outline"}
                  onClick={() => {
                    setFilters((current) => ({ ...current, completed: option.value }));
                    setPage(1);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </TableFilterSection>
              </TableFilterPanel>
            }
          />
        </CardHeader>

        {missingCompanyContext ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">
            Company context is missing for this account. EMSYS API requests require the{" "}
            <code className="text-xs">x-company-id</code> header. Add <code className="text-xs">companyId</code> to
            your Firebase user profile or JWT custom claim, then sign in again.
          </div>
        ) : null}

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : null}

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={orders.map((order) => getOrderRecordId(order))}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const order = orders.find((entry) => getOrderRecordId(entry) === selectedIds[0]);
            if (order) openEditForm(order);
          }}
          onDelete={() =>
            setDeleteTarget(orders.filter((order) => selectedIds.includes(getOrderRecordId(order))))
          }
          deleteDisabled={isSaving}
        />

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading orders…</div>
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
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewOrder}
            onRowDoubleClick={openEditForm}
            emptyState={
              <>
                <p className="text-muted-foreground">No orders match your search or filters.</p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add order
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {isFetching
              ? "Refreshing orders…"
              : `Showing ${orders.length} of ${totalOrders} orders`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <OrderViewSheet
        order={viewOrder}
        orders={orders}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit order" : "Add order"}</DialogTitle>
            <DialogDescription>
              Manage pickup fields: date, branch, employee, sender, receiver, purpose, and comments.
            </DialogDescription>
          </DialogHeader>
          <OrderForm
            key={editingOrder ? getOrderRecordId(editingOrder) : "new"}
            allOrders={orders}
            initialValues={
              formMode === "edit" && editingOrder ? orderToFormValues(editingOrder) : createEmptyOrderForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingOrder?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add order"}
            onSubmit={saveOrder}
            onFormErrorChange={setFormError}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>Delete order{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected orders. This action cannot be undone.`
                : "This will permanently remove this order. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isSaving}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
