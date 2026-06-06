"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
} from "lucide-react";

import { ItemForm } from "@/components/items/item-form";
import { ItemViewSheet } from "@/components/items/item-view-sheet";
import { ColumnVisibilityMenu } from "@/components/app-shell/column-visibility-menu";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
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
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeItemKpis,
  formatItemDate,
  formatItemPrice,
  itemMatchesQuery,
  truncateItemId,
} from "@/lib/items/display";
import { cloneItems } from "@/lib/items/mock-data";
import {
  createEmptyItemForm,
  formValuesToItem,
  itemToFormValues,
  type Item,
  type ItemFilterState,
  type ItemFormValues,
} from "@/lib/items/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 8;

const defaultFilters: ItemFilterState = {
  query: "",
};

export function ItemsWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [items, setItems] = useState<Item[]>(() => cloneItems());
  const [filters, setFilters] = useState<ItemFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewItem, setViewItem] = useState<Item | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | Item[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => itemMatchesQuery(item, filters.query));
  }, [filters.query, items]);

  const kpis = useMemo(() => computeItemKpis(items), [items]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected = pageItems.length > 0 && pageItems.every((item) => selectedIds.includes(item.itemId));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...pageItems.map((item) => item.itemId)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !pageItems.some((item) => item.itemId === id)));
  }

  function toggleSelect(itemId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, itemId] : current.filter((entry) => entry !== itemId)));
  }

  function openAddForm() {
    setEditingItem(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(item: Item) {
    setEditingItem(item);
    setFormMode("edit");
    setViewItem(null);
    setFormError(null);
  }

  function saveItem(values: ItemFormValues) {
    try {
      if (formMode === "edit" && editingItem) {
        const nextItem = formValuesToItem(
          { ...values, createdBy: editingItem.createdBy },
          editingItem.createdAt,
          editingItem.createdBy,
          new Date().toISOString()
        );
        setItems((current) => current.map((item) => (item.itemId === editingItem.itemId ? nextItem : item)));
        notifyUpdated("Item", truncateItemId(nextItem.itemId));
      } else {
        const nextItem = formValuesToItem(values);
        setItems((current) => [nextItem, ...current]);
        notifyAdded("Item", truncateItemId(nextItem.itemId));
      }

      setFormMode(null);
      setEditingItem(null);
      setFormError(null);
      setPage(1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save item.");
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((item) => item.itemId) : [deleteTarget.itemId];
    setItems((current) => current.filter((item) => !ids.includes(item.itemId)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewItem(null);
    notifyDeleted("Item", ids.length);
  }

  const stats = [
    { label: "Total items", value: kpis.total.toString(), description: "Catalog items on record", icon: Tag },
    {
      label: "Average price",
      value: formatItemPrice(kpis.averagePrice),
      description: "Mean item price",
      icon: DollarSign,
    },
    {
      label: "Catalog value",
      value: formatItemPrice(kpis.totalValue),
      description: "Sum of all item prices",
      icon: DollarSign,
    },
  ];

  const tableColumns: DataTableColumn<Item>[] = [
    {
      id: "itemId",
      label: "Item ID",
      cellClassName: "font-mono text-xs",
      renderCell: (item) => truncateItemId(item.itemId),
    },
    {
      id: "description",
      label: "Description",
      cellClassName: "font-medium",
      renderCell: (item) => item.description,
    },
    {
      id: "price",
      label: "Price",
      renderCell: (item) => formatItemPrice(item.price),
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (item) => formatItemDate(item.createdAt),
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
    {
      id: "actions",
      label: "Actions",
      hideable: false,
      stopRowClick: true,
      renderCell: (item) => (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Edit item ${item.itemId}`}
            onClick={() => openEditForm(item)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete item ${item.itemId}`}
            onClick={() => {
              setViewItem(null);
              setDeleteTarget(item);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("items", tableColumns);

  return (
    <div>
      <PageHeader
        title="Items"
        description="Manage catalog items with description, price, and audit details."
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add item
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
              <CardTitle>Item directory</CardTitle>
              <CardDescription>Search by item ID, description, price, or creator.</CardDescription>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-md lg:justify-end">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.query}
                  onChange={(event) => {
                    setFilters({ query: event.target.value });
                    setPage(1);
                  }}
                  className="pl-9"
                  placeholder="Search items..."
                />
              </div>
              <ColumnVisibilityMenu columnLayout={columnVisibility} />
            </div>
          </div>
        </CardHeader>

        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-3 border-b bg-muted/30 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">{selectedIds.length} selected</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                Clear selection
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteTarget(items.filter((item) => selectedIds.includes(item.itemId)))}
              >
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
            </div>
          </div>
        ) : null}

        <DataTable
          columns={columnVisibility.columns}
          rows={pageItems}
          rowKey={(item) => item.itemId}
          rowLabel={(item) => item.description}
          columnLayout={columnVisibility}
          minWidth={960}
          selectable
          selectedIds={selectedIds}
          allPageSelected={allPageSelected}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelect}
          onRowClick={setViewItem}
          emptyState={
            <>
              <p className="text-muted-foreground">No items match your search.</p>
              <Button className="mt-4" onClick={openAddForm}>
                <Plus className="h-4 w-4" />
                Add item
              </Button>
            </>
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

      <ItemViewSheet
        item={viewItem}
        open={Boolean(viewItem)}
        onOpenChange={(open) => {
          if (!open) setViewItem(null);
        }}
        onEdit={openEditForm}
        onDelete={(item) => {
          setViewItem(null);
          setDeleteTarget(item);
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit item" : "Add item"}</DialogTitle>
            <DialogDescription>
              {formMode === "edit" ? "Update the item description and price." : "Create a new catalog item."}
            </DialogDescription>
          </DialogHeader>
          <ItemForm
            key={editingItem?.itemId ?? "new"}
            initialValues={
              formMode === "edit" && editingItem ? itemToFormValues(editingItem) : createEmptyItemForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingItem?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add item"}
            onSubmit={saveItem}
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
            <DialogTitle>Delete item{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected items. This action cannot be undone.`
                : "This will permanently remove this item. This action cannot be undone."}
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
    </div>
  );
}
