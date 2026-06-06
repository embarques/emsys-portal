"use client";

import { useMemo, useState } from "react";
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
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeOrderKpis,
  formatOrderCommentsSummary,
  formatOrderDate,
  formatOrderPartySummary,
  getOrderBranchLabel,
  getRouteAssignmentLabel,
  getRouteName,
  orderMatchesQuery,
  truncateOrderId,
} from "@/lib/orders/display";
import { cloneOrders } from "@/lib/orders/mock-data";
import {
  ORDER_BRANCHES,
  createEmptyOrderForm,
  formValuesToOrder,
  orderToFormValues,
  type Order,
  type OrderFilterState,
  type OrderFormSubmitResult,
  type OrderFormValues,
} from "@/lib/orders/types";
import { cloneRoutes } from "@/lib/routes/mock-data";
import { formatRouteAssignmentCopyLabel } from "@/lib/route-assignments/display";
import { cloneRouteAssignments } from "@/lib/route-assignments/mock-data";
import type { DataTableColumn } from "@/lib/table/types";
import { getBranchBadgeClass } from "@/lib/trucks/display";

const PAGE_SIZE = 8;

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const defaultFilters: OrderFilterState = {
  query: "",
  branch: "all",
};

export function OrdersWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const routes = useMemo(() => cloneRoutes(), []);
  const routeAssignments = useMemo(() => cloneRouteAssignments(), []);
  const [orders, setOrders] = useState<Order[]>(() => cloneOrders());
  const [filters, setFilters] = useState<OrderFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewOrder, setViewOrder] = useState<Order | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | Order[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignRouteAssignmentId, setAssignRouteAssignmentId] = useState(
    () => routeAssignments[0]?.routeAssignmentId ?? ""
  );

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (!orderMatchesQuery(order, filters.query, routes)) return false;
      if (filters.branch !== "all" && order.branch !== filters.branch) return false;
      return true;
    });
  }, [filters, orders, routes]);

  const kpis = useMemo(() => computeOrderKpis(orders), [orders]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected = pageOrders.length > 0 && pageOrders.every((order) => selectedIds.includes(order.orderId));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...pageOrders.map((order) => order.orderId)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !pageOrders.some((order) => order.orderId === id)));
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

  function saveOrder(values: OrderFormValues): OrderFormSubmitResult {
    try {
      if (formMode === "edit" && editingOrder) {
        const nextOrder = formValuesToOrder(
          { ...values, createdBy: editingOrder.createdBy, completed: values.completed },
          editingOrder.createdAt,
          editingOrder.createdBy,
          new Date().toISOString()
        );
        setOrders((current) => current.map((order) => (order.orderId === editingOrder.orderId ? nextOrder : order)));
        notifyUpdated("Order", truncateOrderId(nextOrder.orderId));
        setFormMode(null);
        setEditingOrder(null);
        setFormError(null);
        setPage(1);
        return { error: null };
      }

      const nextOrder = formValuesToOrder(values);
      setOrders((current) => [nextOrder, ...current]);
      notifyAdded("Order", truncateOrderId(nextOrder.orderId));
      setFormError(null);
      setPage(1);
      return { error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save order.";
      setFormError(message);
      return { error: message };
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((order) => order.orderId) : [deleteTarget.orderId];
    setOrders((current) => current.filter((order) => !ids.includes(order.orderId)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewOrder(null);
    notifyDeleted("Order", ids.length);
  }

  function openAssignDialog() {
    if (selectedIds.length === 0) return;
    setAssignRouteAssignmentId(routeAssignments[0]?.routeAssignmentId ?? "");
    setAssignDialogOpen(true);
  }

  function applyRouteAssignment() {
    if (!assignRouteAssignmentId || selectedIds.length === 0) return;

    const now = new Date().toISOString();
    const assignmentLabel = getRouteAssignmentLabel(assignRouteAssignmentId);

    setOrders((current) =>
      current.map((order) =>
        selectedIds.includes(order.orderId)
          ? { ...order, routeAssignmentId: assignRouteAssignmentId, updatedAt: now }
          : order
      )
    );

    setViewOrder((current) =>
      current && selectedIds.includes(current.orderId)
        ? { ...current, routeAssignmentId: assignRouteAssignmentId, updatedAt: now }
        : current
    );

    notifyUpdated("Route assignment", `${selectedIds.length} order(s) → ${assignmentLabel}`);
    setAssignDialogOpen(false);
    setSelectedIds([]);
  }

  const stats = [
    { label: "Total orders", value: kpis.total.toString(), description: "Orders on record", icon: Package },
    { label: "USA", value: kpis.usa.toString(), description: "United States branch", icon: MapPin },
    { label: "DR", value: kpis.dr.toString(), description: "Dominican Republic branch", icon: ClipboardList },
  ];

  const branchFilters: { value: OrderFilterState["branch"]; label: string }[] = [
    { value: "all", label: "All" },
    ...ORDER_BRANCHES,
  ];

  const tableColumns: DataTableColumn<Order>[] = [
    {
      id: "orderId",
      label: "Order ID",
      cellClassName: "font-mono text-xs",
      renderCell: (order) => truncateOrderId(order.orderId),
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
      id: "sender",
      label: "Sender",
      renderCell: (order) => formatOrderPartySummary(order.sender),
    },
    {
      id: "receivers",
      label: "Receivers",
      renderCell: (order) =>
        order.receivers.length > 0
          ? order.receivers.map((receiver) => receiver.name).join(", ")
          : "—",
    },
    {
      id: "route",
      label: "Route",
      renderCell: (order) => getRouteName(order.routeId, routes),
    },
    {
      id: "assignment",
      label: "Assignment",
      renderCell: (order) => getRouteAssignmentLabel(order.routeAssignmentId),
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
        description="Manage orders with sender/receiver parties, route details, and purpose-driven comments."
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add order
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
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
              <CardDescription>Search by order ID, sender, receiver, route, or comments.</CardDescription>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-md lg:justify-end">
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
            {branchFilters.map((option) => (
              <Button
                key={option.value}
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
            ))}
            {filters.query || filters.branch !== "all" ? (
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

        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-3 border-b bg-muted/30 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">{selectedIds.length} selected</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openAssignDialog}>
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
              >
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
            </div>
          </div>
        ) : null}

        <DataTable
          columns={columnVisibility.columns}
          rows={pageOrders}
          rowKey={(order) => order.orderId}
          rowLabel={(order) => order.orderId}
          columnLayout={columnVisibility}
          minWidth={1400}
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

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageOrders.length} of {filteredOrders.length} orders
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
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
              disabled={currentPage >= totalPages}
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
            <Button variant="destructive" onClick={confirmDelete}>
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
            <Button onClick={applyRouteAssignment} disabled={!assignRouteAssignmentId}>
              Apply assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
