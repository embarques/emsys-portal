"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Plus,
  Trash2,
  Warehouse,
} from "lucide-react";

import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { InventoryViewSheet } from "@/components/inventory/inventory-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";

import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
  TableFilterSection,
} from "@/components/app-shell/table-directory-toolbar";
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
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeInventoryKpis,
  getAvailableQuantity,
  getCategoryLabel,
  getLocationLabel,
  getStatusBadgeClass,
  getStatusLabel,
  inventoryMatchesQuery,
} from "@/lib/inventory/display";
import { cloneInventoryItems, normalizeInventoryItem } from "@/lib/inventory/mock-data";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_LOCATIONS,
  INVENTORY_STATUSES,
  type InventoryFilterState,
  type InventoryFormValues,
  type InventoryItem,
} from "@/lib/inventory/types";
import type { DataTableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

const selectClassName =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const defaultFilters: InventoryFilterState = {
  query: "",
  status: "all",
  location: "all",
  category: "all",
};

function itemToFormValues(item: InventoryItem): InventoryFormValues {
  return {
    sku: item.sku,
    name: item.name,
    category: item.category,
    location: item.location,
    quantity: item.quantity,
    reserved: item.reserved,
    reorderLevel: item.reorderLevel,
    unit: item.unit,
    status: item.status,
    notes: item.notes ?? "",
    createdBy: item.createdBy,
  };
}

export function InventoryWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [items, setItems] = useState<InventoryItem[]>(() => cloneInventoryItems());
  const [filters, setFilters] = useState<InventoryFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | InventoryItem[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!inventoryMatchesQuery(item, filters.query)) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.location !== "all" && item.location !== filters.location) return false;
      if (filters.category !== "all" && item.category !== filters.category) return false;
      return true;
    });
  }, [filters, items]);

  const kpis = useMemo(() => computeInventoryKpis(items), [items]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected = pageItems.length > 0 && pageItems.every((item) => selectedIds.includes(item.id));
  const activeFilterCount = [filters.status, filters.location, filters.category].filter((value) => value !== "all").length;

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...pageItems.map((item) => item.id)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !pageItems.some((item) => item.id === id)));
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, id] : current.filter((entry) => entry !== id)));
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setPage(1);
  }

  function openAddForm() {
    setEditingItem(null);
    setFormMode("add");
  }

  function openEditForm(item: InventoryItem) {
    setEditingItem(item);
    setFormMode("edit");
    setViewItem(null);
  }

  function saveItem(values: InventoryFormValues) {
    if (formMode === "edit" && editingItem) {
      const nextItem = normalizeInventoryItem({
        ...values,
        id: editingItem.id,
        notes: values.notes || undefined,
        createdAt: editingItem.createdAt,
        createdBy: editingItem.createdBy,
        updatedAt: new Date().toISOString(),
      });
      setItems((current) => current.map((item) => (item.id === editingItem.id ? nextItem : item)));
      notifyUpdated("Inventory item", nextItem.name);
    } else {
      const nextItem = normalizeInventoryItem({
        ...values,
        notes: values.notes || undefined,
      });
      setItems((current) => [nextItem, ...current]);
      notifyAdded("Inventory item", nextItem.name);
    }

    setFormMode(null);
    setEditingItem(null);
    setPage(1);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((item) => item.id) : [deleteTarget.id];
    setItems((current) => current.filter((item) => !ids.includes(item.id)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewItem(null);
    notifyDeleted("Inventory item", ids.length);
  }

  const stats = [
    { label: "Total SKUs", value: kpis.total.toString(), description: "Tracked inventory items", icon: Boxes },
    { label: "In stock", value: kpis.inStock.toString(), description: "Available for fulfillment", icon: PackageCheck },
    { label: "Low stock", value: kpis.lowStock.toString(), description: "Below reorder threshold", icon: Warehouse },
    { label: "Needs review", value: kpis.needsReview.toString(), description: "Out of stock or flagged", icon: AlertTriangle },
  ];

  const tableColumns: DataTableColumn<InventoryItem>[] = [
    {
      id: "sku",
      label: "SKU",
      cellClassName: "font-medium",
      renderCell: (item) => item.sku,
    },
    {
      id: "item",
      label: "Item",
      renderCell: (item) => (
        <>
          <div className="font-medium">{item.name}</div>
          <div className="text-xs text-muted-foreground">{getCategoryLabel(item.category)}</div>
        </>
      ),
    },
    {
      id: "location",
      label: "Location",
      renderCell: (item) => getLocationLabel(item.location),
    },
    {
      id: "onHand",
      label: "On hand",
      renderCell: (item) => (
        <>
          {item.quantity} {item.unit}
          {item.reserved > 0 ? (
            <div className="text-xs text-muted-foreground">{item.reserved} reserved</div>
          ) : null}
        </>
      ),
    },
    {
      id: "available",
      label: "Available",
      renderCell: (item) => (
        <>
          {getAvailableQuantity(item)} {item.unit}
        </>
      ),
    },
    {
      id: "status",
      label: "Status",
      renderCell: (item) => (
        <Badge className={getStatusBadgeClass(item.status)}>{getStatusLabel(item.status)}</Badge>
      ),
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (item) => formatAuditDate(item.createdAt),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (item) => item.createdBy,
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (item) => formatAuditDate(item.updatedAt),
    },
  ];

  const columnVisibility = useColumnVisibility("inventory", tableColumns);
  const hasActiveFilters =
    Boolean(filters.query.trim()) ||
    filters.status !== "all" ||
    filters.location !== "all" ||
    filters.category !== "all";

  return (
    <div>
      <PageHeader
        title="Inventory"
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        }
      />

      <StatCardsGrid>
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
      </StatCardsGrid>

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
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
                placeholder="Search inventory..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${filteredItems.length} of ${items.length} items`}
                onClearAll={hasActiveFilters ? resetFilters : undefined}
              >
            <TableFilterSection label="Status">
              <select
                id="filter-status"
                className={cn(selectClassName, "min-w-[12rem]")}
                value={filters.status}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as InventoryFilterState["status"],
                  }));
                  setPage(1);
                }}
              >
                <option value="all">All statuses</option>
                {INVENTORY_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </TableFilterSection>

            <TableFilterSection label="Location">
              <select
                id="filter-location"
                className={cn(selectClassName, "min-w-[12rem]")}
                value={filters.location}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    location: event.target.value as InventoryFilterState["location"],
                  }));
                  setPage(1);
                }}
              >
                <option value="all">All locations</option>
                {INVENTORY_LOCATIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </TableFilterSection>

            <TableFilterSection label="Category">
              <select
                id="filter-category"
                className={cn(selectClassName, "min-w-[12rem]")}
                value={filters.category}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    category: event.target.value as InventoryFilterState["category"],
                  }));
                  setPage(1);
                }}
              >
                <option value="all">All categories</option>
                {INVENTORY_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </TableFilterSection>
              </TableFilterPanel>
            }
          />
        </CardHeader>

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={pageItems.map((item) => item.id)}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const item = pageItems.find((entry) => entry.id === selectedIds[0]);
            if (item) openEditForm(item);
          }}
          onDelete={() => setDeleteTarget(items.filter((item) => selectedIds.includes(item.id)))}
        />

        <DataTable
          columns={columnVisibility.columns}
          rows={pageItems}
          page={currentPage}
          rowKey={(item) => item.id}
          rowLabel={(item) => item.sku}
          columnLayout={columnVisibility}
          minWidth={1050}
          selectable
          selectedIds={selectedIds}
          allPageSelected={allPageSelected}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelect}
          onRowClick={setViewItem}
          onRowDoubleClick={openEditForm}
          emptyState={
            <p className="text-muted-foreground">No inventory items match your search or filters.</p>
          }
        />

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageItems.length} of {filteredItems.length} items
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

      <InventoryViewSheet
        item={viewItem}
        open={Boolean(viewItem)}
        onOpenChange={(open) => {
          if (!open) setViewItem(null);
        }}
        onEdit={openEditForm}
        onDelete={(item) => setDeleteTarget(item)}
      />

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit inventory item" : "Add inventory item"}</DialogTitle>
            <DialogDescription>
              {formMode === "edit"
                ? "Update stock counts, location, and status for this SKU."
                : "Create a new warehouse item to track in inventory."}
            </DialogDescription>
          </DialogHeader>
          <InventoryItemForm
            key={editingItem?.id ?? "new"}
            initialValues={editingItem ? itemToFormValues(editingItem) : undefined}
            isEditing={formMode === "edit"}
            updatedAt={editingItem?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add item"}
            onSubmit={saveItem}
            onCancel={() => setFormMode(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete inventory items?</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected items from inventory.`
                : `This will permanently remove ${deleteTarget?.name ?? "this item"} from inventory.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
