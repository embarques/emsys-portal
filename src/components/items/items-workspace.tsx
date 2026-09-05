"use client";

import { useMemo, useState } from "react";
import {
  DollarSign,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";

import { ItemForm } from "@/components/items/item-form";
import { ItemViewSheet } from "@/components/items/item-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
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
import { formatAuditDateTime } from "@/lib/audit/display";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import { computeItemKpis, formatItemPrice, truncateItemId } from "@/lib/items/display";
import { useItemFilterFields } from "@/lib/items/hooks/use-item-filter-fields";
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
  areItemFormValuesEquivalent,
} from "@/lib/items/types";
import type { DataTableColumn } from "@/lib/table/types";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import { buildToolbarSearchSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";

const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: ItemFilterState = {
  query: "",
  rows: [],
};

export function ItemsWorkspace() {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const { toErrorMessage } = useUserError();
  const itemFilterFields = useItemFilterFields();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess } = useFeedback();
  const [filters, setFilters] = useState<ItemFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_ITEM_LIST_PARAMS.sort, () => setPage(1));
  const [viewItem, setViewItem] = useState<Item | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | Item[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () => buildItemListParams({ page, limit: pageLimit, query: debouncedQuery, rows: filters.rows, sort }),
    [debouncedQuery, filters.rows, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useItems(listParams);
  const stats = useItemStats();
  const kpiQuery = useItemKpis();
  const createItemMutation = useCreateItem();
  const updateItemMutation = useUpdateItem();
  const deleteItemsMutation = useDeleteItems();

  const items = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const totalItems = data?.total ?? 0;
  rememberTotal(totalItems);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected = items.length > 0 && items.every((item) => selectedIds.includes(item.itemId));
  const isSaving =
    createItemMutation.isPending || updateItemMutation.isPending || deleteItemsMutation.isPending;

  useTableSelectionReset(
    buildTableSelectionResetKey(debouncedQuery, filters.rows),
    setSelectedIds,
  );

  const kpis = useMemo(() => computeItemKpis(kpiQuery.items), [kpiQuery.items]);
  const listErrorMessage = isError ? toErrorMessage(error) : null;

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
      openFormTab({ feature: "items", baseHref: "/items", mode: "add", label: t("items.actions.add") });
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
        label: t("items.actions.editNamed", {
          name: item.description || truncateItemId(item.itemId),
        }),
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
        if (areItemFormValuesEquivalent(values, itemToFormValues(editingItem))) {
          notifySuccess(t("common.form.noChanges"));
          setFormMode(null);
          setEditingItem(null);
          return;
        }

        const nextItem = await updateItemMutation.mutateAsync({ itemId: editingItem.itemId, values });
        notifyUpdated(t("items.entity"), nextItem.description || truncateItemId(nextItem.itemId));
      } else {
        const nextItem = await createItemMutation.mutateAsync(values);
        notifyAdded(t("items.entity"), nextItem.description || truncateItemId(nextItem.itemId));
      }

      setFormMode(null);
      setEditingItem(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(toErrorMessage(mutationError));
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
      notifyDeleted(t("items.entity"), ids.length);
    } catch (mutationError) {
      setFormError(toErrorMessage(mutationError));
      setDeleteTarget(null);
    }
  }

  const stat = useMemo(
    () => [
      {
        label: t("items.stats.total.label"),
        value: stats.isLoading ? "…" : stats.total.toString(),
        description: t("items.stats.total.description"),
        icon: Tag,
      },
      {
        label: t("items.stats.averagePrice.label"),
        value: kpiQuery.isLoading ? "…" : formatItemPrice(kpis.averagePrice),
        description: t("items.stats.averagePrice.description"),
        icon: DollarSign,
      },
      {
        label: t("items.stats.catalogValue.label"),
        value: kpiQuery.isLoading ? "…" : formatItemPrice(kpis.totalValue),
        description: t("items.stats.catalogValue.description"),
        icon: DollarSign,
      },
    ],
    [kpiQuery.isLoading, kpis.averagePrice, kpis.totalValue, stats.isLoading, stats.total, t],
  );

  const tableColumns: DataTableColumn<Item>[] = useMemo(
    () => [
      {
        id: "itemId",
        label: t("items.columns.itemId"),
        sortField: "id",
        cellClassName: "font-mono text-xs",
        renderCell: (item) => truncateItemId(item.itemId),
      },
      {
        id: "description",
        label: t("items.columns.description"),
        sortField: "name",
        cellClassName: "font-medium",
        renderCell: (item) => item.description,
      },
      {
        id: "price",
        label: t("items.columns.price"),
        renderCell: (item) => formatItemPrice(item.price),
      },
      {
        id: "createdAt",
        label: t("items.columns.createdAt"),
        cellClassName: "text-muted-foreground",
        renderCell: (item) => formatAuditDateTime(item.createdAt),
      },
      {
        id: "createdBy",
        label: t("items.columns.createdBy"),
        defaultVisible: false,
        cellClassName: "text-muted-foreground",
        renderCell: (item) => item.createdBy || dash,
      },
      {
        id: "updatedAt",
        label: t("items.columns.updatedAt"),
        cellClassName: "text-muted-foreground",
        renderCell: (item) => formatAuditDateTime(item.updatedAt),
      },
      {
        id: "updatedBy",
        label: t("items.columns.updatedBy"),
        defaultVisible: false,
        cellClassName: "text-muted-foreground",
        renderCell: (item) => item.updatedBy || dash,
      },
    ],
    [dash, t],
  );

  const columnVisibility = useColumnVisibility("items-v2", tableColumns);
  const advancedFilterCount = countCompleteFilterRows(filters.rows, itemFilterFields);
  const hasActiveFilters = Boolean(filters.query.trim()) || advancedFilterCount > 0;
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveFilters,
      query: filters.query,
      isSearchPending,
      matched: totalItems,
      catalogTotal: stats.total,
      noun: t("items.noun"),
      isLoading: isFetching && items.length === 0,
      catalogLoading: stats.isLoading,
    },
    t,
  );
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: items.length,
      page: currentPage,
      pageSize: pageLimit,
      total: totalItems,
      noun: t("items.noun"),
      isFiltered: hasActiveFilters,
      isLoading: isFetching,
      catalogTotal: stats.total,
      catalogLoading: stats.isLoading,
    },
    t,
  );

  return (
    <div>
      <PageHeader
        title={t("items.title")}
        description={t("items.pages.description")}
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            {t("items.actions.add")}
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
                placeholder={t("items.search.placeholder")}
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={listSummary}
                presets={{
                  storageKey: "items",
                  rows: filters.rows,
                  fields: itemFilterFields,
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
                  fields={itemFilterFields}
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
            title={t("items.loading.title")}
            description={t("items.loading.description")}
            columns={t("items.loading.columns").split(", ")}
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
            activeRowId={viewItem?.itemId}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveFilters ? t("items.empty.noMatch") : t("items.empty.noneYet")}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  {t("items.actions.add")}
                </Button>
              </>
            }
          />
        )}

        {!isLoading ? (
        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{listSummary}</p>
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
            <DialogTitle>
              {formMode === "edit" ? t("items.form.editTitle") : t("items.form.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <ItemForm
            key={editingItem?.itemId ?? "new"}
            initialValues={
              formMode === "edit" && editingItem ? itemToFormValues(editingItem) : createEmptyItemForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingItem?.updatedAt}
            submitLabel={
              formMode === "edit" ? t("common.actions.saveChanges") : t("items.actions.add")
            }
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
            <DialogTitle>
              {Array.isArray(deleteTarget) && deleteTarget.length > 1
                ? t("items.dialogs.deleteTitlePlural")
                : t("items.dialogs.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("items.dialogs.deleteMany", {
                    count: deleteTarget.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("items.dialogs.deleteOne", {
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isSaving}>
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton isPending={isSaving} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
