"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";

import { ItemForm } from "@/components/items/item-form";
import { ItemViewSheet } from "@/components/items/item-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDateTime } from "@/lib/audit/display";
import { computeItemKpis, formatItemPrice, truncateItemId } from "@/lib/items/display";
import {
  useCreateItem,
  useDeleteItems,
  useItemKpis,
  useItemStats,
  useItems,
  useUpdateItem,
} from "@/lib/items/hooks/use-items";
import {
  DEFAULT_ITEM_LIST_PARAMS,
  buildItemListParams,
  createEmptyItemForm,
  itemToFormValues,
  type Item,
  type ItemFilterState,
  type ItemFormValues,
} from "@/lib/items/types";
import { ITEM_TABLE_FILTER_FIELDS } from "@/lib/items/filter-fields";
import type { DataTableColumn } from "@/lib/table/types";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { useTableSort } from "@/lib/table/use-table-sort";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";

const PAGE_SIZE = DEFAULT_ITEM_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: ItemFilterState = {
  query: "",
  rows: [],
};

export function ItemsWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<ItemFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_ITEM_LIST_PARAMS.sort, () => setPage(1));
  const [viewItem, setViewItem] = useState<Item | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | Item[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () => buildItemListParams({ page, limit: PAGE_SIZE, query: debouncedQuery, rows: filters.rows, sort }),
    [debouncedQuery, filters.rows, page, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useItems(listParams);
  const stats = useItemStats();
  const kpiQuery = useItemKpis();
  const createItemMutation = useCreateItem();
  const updateItemMutation = useUpdateItem();
  const deleteItemsMutation = useDeleteItems();

  const items = data?.items ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.itemId));
  const isSaving =
    createItemMutation.isPending || updateItemMutation.isPending || deleteItemsMutation.isPending;

  const kpis = useMemo(() => computeItemKpis(kpiQuery.items), [kpiQuery.items]);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...items.map((item) => item.itemId)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !items.some((item) => item.itemId === id)));
  }

  function toggleSelect(itemId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, itemId] : current.filter((entry) => entry !== itemId)));
  }

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({ feature: "items", baseHref: "/items", mode: "add", label: "Add item" });
      return;
    }
    setEditingItem(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(item: Item) {
    if (isDesktopTabs) {
      setViewItem(null);
      openFormTab({
        feature: "items",
        baseHref: "/items",
        mode: "edit",
        entityId: item.itemId,
        label: `Edit ${item.description || truncateItemId(item.itemId)}`,
      });
      return;
    }
    setEditingItem(item);
    setFormMode("edit");
    setViewItem(null);
    setFormError(null);
  }

  async function saveItem(values: ItemFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingItem) {
        const nextItem = await updateItemMutation.mutateAsync({ itemId: editingItem.itemId, values });
        notifyUpdated("Item", nextItem.description || truncateItemId(nextItem.itemId));
      } else {
        const nextItem = await createItemMutation.mutateAsync(values);
        notifyAdded("Item", nextItem.description || truncateItemId(nextItem.itemId));
      }

      setFormMode(null);
      setEditingItem(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((item) => item.itemId) : [deleteTarget.itemId];

    try {
      await deleteItemsMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewItem(null);
      notifyDeleted("Item", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const stat = [
    { label: "Total items", value: stats.isLoading ? "…" : stats.total.toString(), description: "Catalog items on record", icon: Tag },
    {
      label: "Average price",
      value: kpiQuery.isLoading ? "…" : formatItemPrice(kpis.averagePrice),
      description: "Mean item price",
      icon: DollarSign,
    },
    {
      label: "Catalog value",
      value: kpiQuery.isLoading ? "…" : formatItemPrice(kpis.totalValue),
      description: "Sum of all item prices",
      icon: DollarSign,
    },
  ];

  const tableColumns: DataTableColumn<Item>[] = [
    {
      id: "itemId",
      label: "Item ID",
      sortField: "id",
      cellClassName: "font-mono text-xs",
      renderCell: (item) => truncateItemId(item.itemId),
    },
    {
      id: "description",
      label: "Description",
      sortField: "name",
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
      renderCell: (item) => formatAuditDateTime(item.createdAt),
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (item) => formatAuditDateTime(item.updatedAt),
    },
  ];

  const columnVisibility = useColumnVisibility("items-v2", tableColumns);
  const advancedFilterCount = countCompleteFilterRows(filters.rows, ITEM_TABLE_FILTER_FIELDS);
  const hasActiveFilters = Boolean(filters.query.trim()) || advancedFilterCount > 0;
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    isSearchPending,
    matched: totalItems,
    catalogTotal: stats.total,
    noun: "items",
    isLoading: isFetching && items.length === 0,
    catalogLoading: stats.isLoading,
  });

  return (
    <div>
      <PageHeader
        title="Items"
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        }
      />

      <StatCards items={stat} />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={advancedFilterCount}
            columnLayout={columnVisibility}
            searchSummary={searchSummary}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters((current) => ({ ...current, query }));
                  setPage(1);
                }}
                placeholder="Search items..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${items.length} of ${totalItems} items`}
                presets={{
                  storageKey: "items",
                  rows: filters.rows,
                  fields: ITEM_TABLE_FILTER_FIELDS,
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
                  fields={ITEM_TABLE_FILTER_FIELDS}
                  onChange={(rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  }}
                />
              </TableFilterPanel>
            }
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={items.map((item) => item.itemId)}
          totalCount={totalItems}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const item = items.find((entry) => entry.itemId === selectedIds[0]);
            if (item) openEditForm(item);
          }}
          onDelete={() => setDeleteTarget(items.filter((item) => selectedIds.includes(item.itemId)))}
        />

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : null}

        {isLoading ? (
          <DirectoryTableLoader
            icon={Tag}
            title="Loading items"
            description="Organizing item details, pricing, and catalog information…"
            columns={["Item", "Description", "Price", "Created", "Updated"]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={items}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(item) => item.itemId}
            rowLabel={(item) => item.description}
            columnLayout={columnVisibility}
            sort={sort}
            onSortChange={onSortChange}
            minWidth={960}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewItem}
            onRowDoubleClick={openEditForm}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveFilters ? "No items match your filters." : "No items yet."}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add item
                </Button>
              </>
            }
          />
        )}

        {!isLoading ? (
        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {items.length} of {totalItems} items
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
        ) : null}
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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{formMode === "edit" ? "Edit item" : "Add item"}</DialogTitle>
          </DialogHeader>
          <ItemForm
            key={editingItem?.itemId ?? "new"}
            initialValues={
              formMode === "edit" && editingItem ? itemToFormValues(editingItem) : createEmptyItemForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingItem?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add item"}
            externalError={formError}
            isSubmitting={isSaving}
            onSubmit={saveItem}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isSaving}>
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
