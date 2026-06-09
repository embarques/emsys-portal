"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
} from "lucide-react";

import { OrderForm } from "@/components/orders/order-form";
import { OrderViewSheet } from "@/components/orders/order-view-sheet";
import { ColumnVisibilityMenu } from "@/components/app-shell/column-visibility-menu";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDate } from "@/lib/audit/display";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  formatOrderCommentsSummary,
  formatOrderDate,
  formatOrderId,
  formatOrderPartySummary,
  getOrderBranchLabel,
  getOrderCompletedLabel,
  getRouteAssignmentLabel,
  getRouteName,
} from "@/lib/orders/display";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import {
  useCreateOrder,
  useDeleteOrders,
  useOrderStats,
  useOrders,
  useUpdateOrder,
  useUpdateOrderRouteAssignment,
} from "@/lib/orders/hooks/use-orders";
import {
  DEFAULT_ORDER_LIST_PARAMS,
  ORDER_SEARCH_FIELDS,
  createEmptyOrderForm,
  createOrderSearchFilter,
  getDefaultOrderSearchOperator,
  getOrderSearchOperatorsForField,
  orderToFormValues,
  type Order,
  type OrderFilterState,
  type OrderFormValues,
} from "@/lib/orders/types";
import { formatRouteAssignmentCopyLabel } from "@/lib/route-assignments/display";
import { cloneRouteAssignments } from "@/lib/route-assignments/mock-data";
import type { DataTableColumn } from "@/lib/table/types";
import { cloneRoutes } from "@/lib/routes/mock-data";
import { getBranchBadgeClass } from "@/lib/trucks/display";

const PAGE_SIZE = DEFAULT_ORDER_LIST_PARAMS.limit;

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const defaultFilters: OrderFilterState = {
  query: "",
  searchField: "sender.name",
  searchOperator: "contains",
  branch: "all",
  completed: "all",
};

export function OrdersWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const { loading: authLoading, companyId } = useAuth();
  const routes = useMemo(() => cloneRoutes(), []);
  const routeAssignments = useMemo(() => cloneRouteAssignments(), []);
  const [filters, setFilters] = useState<OrderFilterState>(defaultFilters);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | Order[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignRouteAssignmentId, setAssignRouteAssignmentId] = useState(
    () => routeAssignments[0]?.routeAssignmentId ?? "",
  );

  const listParams = useMemo(() => {
    const search = createOrderSearchFilter(deferredQuery, filters.searchField, filters.searchOperator);

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
    filters.searchField,
    filters.searchOperator,
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
  const updateRouteAssignmentMutation = useUpdateOrderRouteAssignment();

  const orders = data?.items ?? [];
  const totalOrders = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalOrders / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    orders.length > 0 && orders.every((order) => selectedIds.includes(order.orderId));
  const isSaving =
    createOrderMutation.isPending ||
    updateOrderMutation.isPending ||
    deleteOrdersMutation.isPending ||
    updateRouteAssignmentMutation.isPending;
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const missingCompanyContext = !authLoading && !companyId;

  const searchOperatorOptions = useMemo(
    () =>
      getOrderSearchOperatorsForField(filters.searchField).map((operator) => ({
        value: operator,
        label:
          operator === "startsWith"
            ? "Starts with"
            : operator === "contains"
              ? "Contains"
              : operator === "eq"
                ? "Equals"
                : "Not equals",
      })),
    [filters.searchField],
  );

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
        Array.from(new Set([...current, ...orders.map((order) => order.orderId)])),
      );
      return;
    }

    setSelectedIds((current) => current.filter((id) => !orders.some((order) => order.orderId === id)));
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
          orderId: editingOrder.orderId,
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
      ? deleteTarget.map((order) => order.orderId)
      : [deleteTarget.orderId];

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

  function openAssignDialog() {
    if (selectedIds.length === 0) return;
    setAssignRouteAssignmentId(routeAssignments[0]?.routeAssignmentId ?? "");
    setAssignDialogOpen(true);
  }

  async function applyRouteAssignment() {
    if (!assignRouteAssignmentId || selectedIds.length === 0) return;

    const assignmentLabel = getRouteAssignmentLabel(assignRouteAssignmentId);

    try {
      await Promise.all(
        selectedIds.map((orderId) =>
          updateRouteAssignmentMutation.mutateAsync({
            orderId,
            routeAssignmentId: assignRouteAssignmentId,
          }),
        ),
      );

      notifyUpdated("Route assignment", `${selectedIds.length} order(s) → ${assignmentLabel}`);
      setAssignDialogOpen(false);
      setSelectedIds([]);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setAssignDialogOpen(false);
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
      id: "orderId",
      label: "Pickup #",
      cellClassName: "font-mono text-xs",
      renderCell: (order) => formatOrderId(order),
    },
    {
      id: "date",
      label: "Date",
      renderCell: (order) => formatOrderDate(order.date),
    },
    {
      id: "branch",
      label: "Branch",
      renderCell: (order) => (
        <Badge className={getBranchBadgeClass(order.branch)}>{getOrderBranchLabel(order.branch)}</Badge>
      ),
    },
    {
      id: "status",
      label: "Status",
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
      id: "sender",
      label: "Sender",
      renderCell: (order) => formatOrderPartySummary(order.sender),
    },
    {
      id: "purpose",
      label: "Purpose",
      renderCell: (order) => order.purpose || "—",
    },
    {
      id: "sector",
      label: "Sector",
      renderCell: (order) => order.sectorName || "—",
    },
    {
      id: "receivers",
      label: "Receivers",
      renderCell: (order) =>
        order.receivers.length > 0 ? order.receivers.map((receiver) => receiver.name).join(", ") : "—",
    },
    {
      id: "route",
      label: "Route",
      renderCell: (order) => (order.routeId ? getRouteName(order.routeId, routes) : "—"),
    },
    {
      id: "assignment",
      label: "Assignment",
      renderCell: (order) => (order.routeAssignmentId ? getRouteAssignmentLabel(order.routeAssignmentId) : "—"),
    },
    {
      id: "comments",
      label: "Comments",
      renderCell: (order) => formatOrderCommentsSummary(order),
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatAuditDate(order.createdAt),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (order) => order.createdBy,
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (order) => formatAuditDate(order.updatedAt),
    },
    {
      id: "actions",
      label: "Actions",
      hideable: false,
      stopRowClick: true,
      renderCell: (order) => (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Edit order ${order.orderId}`}
            onClick={() => openEditForm(order)}
            disabled={isSaving}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete order ${order.orderId}`}
            onClick={() => {
              setViewOrder(null);
              setDeleteTarget(order);
            }}
            disabled={isSaving}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("orders", tableColumns);

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Pickup orders from GET /pickups with sender, purpose, comments, branch, and completion status."
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
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Order directory</CardTitle>
              <CardDescription>
                Server-backed list from GET /pickups. Use POST /pickups/search for nested sender filters.
              </CardDescription>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:max-w-3xl lg:justify-end">
              <select
                aria-label="Search field"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={filters.searchField}
                onChange={(event) => {
                  const searchField = event.target.value as OrderFilterState["searchField"];
                  setFilters((current) => {
                    const allowedOperators = getOrderSearchOperatorsForField(searchField);
                    const searchOperator = allowedOperators.includes(current.searchOperator)
                      ? current.searchOperator
                      : getDefaultOrderSearchOperator(searchField);

                    return {
                      ...current,
                      searchField,
                      searchOperator,
                    };
                  });
                  setPage(1);
                }}
              >
                {ORDER_SEARCH_FIELDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Search operator"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={filters.searchOperator}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    searchOperator: event.target.value as OrderFilterState["searchOperator"],
                  }));
                  setPage(1);
                }}
              >
                {searchOperatorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.query}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, query: event.target.value }));
                    setPage(1);
                  }}
                  className="pl-9"
                  placeholder="Search orders..."
                />
              </div>
              <ColumnVisibilityMenu columnLayout={columnVisibility} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch</span>
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
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
            {filters.query || filters.branch !== "all" || filters.completed !== "all" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFilters(defaultFilters);
                  setPage(1);
                }}
              >
                Clear search & filters
              </Button>
            ) : null}
          </div>
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

        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-3 border-b bg-muted/30 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">{selectedIds.length} selected</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openAssignDialog} disabled={isSaving}>
                <Truck className="h-4 w-4" />
                Assign to route ({selectedIds.length})
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                Clear selection
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteTarget(orders.filter((order) => selectedIds.includes(order.orderId)))}
                disabled={isSaving}
              >
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading orders…</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={orders}
            rowKey={(order) => order.orderId}
            rowLabel={(order) => formatOrderId(order)}
            columnLayout={columnVisibility}
            minWidth={1500}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewOrder}
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
              Manage sender and receivers with phones, addresses, and order-specific address selection.
            </DialogDescription>
          </DialogHeader>
          <OrderForm
            key={editingOrder?.orderId ?? "new"}
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

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to route assignment</DialogTitle>
            <DialogDescription>
              Update the route assignment for {selectedIds.length} selected order
              {selectedIds.length === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bulkRouteAssignment">Route assignment</Label>
            <select
              id="bulkRouteAssignment"
              className={selectClassName}
              value={assignRouteAssignmentId}
              onChange={(event) => setAssignRouteAssignmentId(event.target.value)}
            >
              {routeAssignments.map((assignment) => (
                <option key={assignment.routeAssignmentId} value={assignment.routeAssignmentId}>
                  {formatRouteAssignmentCopyLabel(assignment)}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyRouteAssignment} disabled={!assignRouteAssignmentId || isSaving}>
              Apply assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
