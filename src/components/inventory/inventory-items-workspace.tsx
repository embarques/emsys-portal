"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Plus,
  SlidersHorizontal,
  Truck,
  Warehouse,
} from "lucide-react";

import { InventoryAdjustmentForm } from "@/components/inventory/inventory-adjustment-form";
import { InventoryDispatchForm } from "@/components/inventory/inventory-dispatch-form";
import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { InventoryItemMobileList } from "@/components/inventory/inventory-item-mobile-list";
import { InventoryReceiptForm } from "@/components/inventory/inventory-receipt-form";
import { InventoryViewSheet } from "@/components/inventory/inventory-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
  TableFilterSection,
} from "@/components/app-shell/table-directory-toolbar";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useUserError } from "@/lib/errors";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { useTranslation } from "@/lib/i18n";
import {
  computeInventoryKpis,
  getAvailableQuantity,
  getCategoryLabel,
  getInventoryCategoryOptions,
  getInventoryLocationOptions,
  getInventoryStatusOptions,
  getLocationLabel,
  getStatusBadgeClass,
  getStatusLabel,
  inventoryMatchesQuery,
} from "@/lib/inventory/display";
import {
  useCreateAdjustment,
  useCreateDispatch,
  useCreateInventoryItem,
  useCreateReceipt,
  useDeleteInventoryItems,
  useInventoryItems,
  useInventoryRecipients,
  useInventorySnapshotData,
  useUpdateInventoryItem,
} from "@/lib/inventory/hooks/use-inventory";
import {
  type InventoryFilterState,
  type InventoryFormValues,
  type InventoryItem,
} from "@/lib/inventory/types";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { buildTableSelectionResetKey, useTableSelectionReset } from "@/lib/table/directory-table-state";

const PAGE_SIZE = 50;

const defaultFilters: InventoryFilterState = {
  query: "",
  status: "all",
  location: "all",
  category: "all",
};

type DocumentDialog = "receipt" | "dispatch" | "adjustment" | null;

function itemToFormValues(item: InventoryItem): InventoryFormValues {
  return {
    sku: item.sku,
    name: item.name,
    category: item.category,
    location: item.location,
    reserved: item.reserved,
    reorderLevel: item.reorderLevel,
    unit: item.unit,
    notes: item.notes ?? "",
    createdBy: item.createdBy,
  };
}

export function InventoryItemsWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess } = useFeedback();
  const { data: items = [], isLoading } = useInventoryItems();
  const { data: recipients = [] } = useInventoryRecipients();
  const snapshot = useInventorySnapshotData();

  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItems = useDeleteInventoryItems();
  const createReceipt = useCreateReceipt();
  const createDispatch = useCreateDispatch();
  const createAdjustment = useCreateAdjustment();

  const [filters, setFilters] = useState<InventoryFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | InventoryItem[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [documentDialog, setDocumentDialog] = useState<DocumentDialog>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!inventoryMatchesQuery(item, filters.query, t)) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.location !== "all" && item.location !== filters.location) return false;
      if (filters.category !== "all" && item.category !== filters.category) return false;
      return true;
    });
  }, [filters, items, t]);

  const kpis = useMemo(() => computeInventoryKpis(items), [items]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected = pageItems.length > 0 && pageItems.every((item) => selectedIds.includes(item.id));
  const activeFilterCount = [filters.status, filters.location, filters.category].filter((value) => value !== "all").length;

  useTableSelectionReset(
    buildTableSelectionResetKey(filters.query, filters.status, filters.location, filters.category),
    setSelectedIds,
  );

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

  async function saveItem(values: InventoryFormValues) {
    try {
      if (formMode === "edit" && editingItem) {
        if (areFormValuesEquivalent(values, itemToFormValues(editingItem))) {
          notifySuccess(t("common.form.noChanges"));
          setFormMode(null);
          setEditingItem(null);
          return;
        }
        const nextItem = await updateItem.mutateAsync({ id: editingItem.id, values });
        notifyUpdated(t("inventory.entity"), nextItem.name);
      } else {
        const nextItem = await createItem.mutateAsync(values);
        notifyAdded(t("inventory.entity"), nextItem.name);
      }
      setFormMode(null);
      setEditingItem(null);
      setPage(1);
    } catch (error) {
      setFormError(toErrorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((item) => item.id) : [deleteTarget.id];
    await deleteItems.mutateAsync(ids);
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewItem(null);
    notifyDeleted(t("inventory.entity"), ids.length);
  }

  const stats = [
    {
      label: t("inventory.stats.totalSkus.label"),
      value: kpis.total.toString(),
      description: t("inventory.stats.totalSkus.description"),
      icon: Boxes,
    },
    {
      label: t("inventory.stats.inStock.label"),
      value: kpis.inStock.toString(),
      description: t("inventory.stats.inStock.description"),
      icon: PackageCheck,
    },
    {
      label: t("inventory.stats.lowStock.label"),
      value: kpis.lowStock.toString(),
      description: t("inventory.stats.lowStock.description"),
      icon: Warehouse,
    },
    {
      label: t("inventory.stats.needsReview.label"),
      value: kpis.needsReview.toString(),
      description: t("inventory.stats.needsReview.description"),
      icon: AlertTriangle,
    },
  ];

  const tableColumns: DataTableColumn<InventoryItem>[] = [
    {
      id: "sku",
      label: t("inventory.columns.sku"),
      cellClassName: "font-medium",
      renderCell: (item) => item.sku,
    },
    {
      id: "item",
      label: t("inventory.columns.item"),
      renderCell: (item) => (
        <>
          <div className="font-medium">{item.name}</div>
          <div className="text-xs text-muted-foreground">{getCategoryLabel(item.category, t)}</div>
        </>
      ),
    },
    {
      id: "location",
      label: t("inventory.columns.location"),
      renderCell: (item) => getLocationLabel(item.location, t),
    },
    {
      id: "onHand",
      label: t("inventory.columns.onHand"),
      renderCell: (item) => (
        <>
          {item.quantity} {item.unit}
          {item.reserved > 0 ? (
            <div className="text-xs text-muted-foreground">
              {item.reserved} {t("inventory.form.fields.reserved").toLowerCase()}
            </div>
          ) : null}
        </>
      ),
    },
    {
      id: "available",
      label: t("inventory.columns.available"),
      renderCell: (item) => (
        <>
          {getAvailableQuantity(item)} {item.unit}
        </>
      ),
    },
    {
      id: "reorderLevel",
      label: t("inventory.columns.reorderLevel"),
      renderCell: (item) => `${item.reorderLevel} ${item.unit}`,
    },
    {
      id: "status",
      label: t("inventory.columns.status"),
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (item) => (
        <TableTagText className={getStatusBadgeClass(item.status)}>{getStatusLabel(item.status, t)}</TableTagText>
      ),
    },
    {
      id: "createdAt",
      label: t("inventory.columns.dateCreated"),
      cellClassName: "text-muted-foreground",
      renderCell: (item) => formatAuditDateTime(item.createdAt),
    },
    {
      id: "createdBy",
      label: t("inventory.columns.userCreated"),
      cellClassName: "text-muted-foreground",
      renderCell: (item) => item.createdBy,
    },
    {
      id: "updatedAt",
      label: t("inventory.columns.dateModified"),
      cellClassName: "text-muted-foreground",
      renderCell: (item) => formatAuditDateTime(item.updatedAt),
    },
  ];

  const columnVisibility = useColumnVisibility("inventory-items", tableColumns);
  const hasActiveFilters =
    Boolean(filters.query.trim()) ||
    filters.status !== "all" ||
    filters.location !== "all" ||
    filters.category !== "all";
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    matched: filteredItems.length,
    catalogTotal: items.length,
    noun: t("inventory.noun"),
  });

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="hidden md:block">
        <PageHeader
          title={t("inventory.submenus.items")}
          description={t("inventory.pages.items")}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setDocumentDialog("receipt")}>
                <PackageCheck className="h-4 w-4" />
                {t("inventory.actions.newReceipt")}
              </Button>
              <Button variant="outline" onClick={() => setDocumentDialog("dispatch")}>
                <Truck className="h-4 w-4" />
                {t("inventory.actions.newDispatch")}
              </Button>
              <Button variant="outline" onClick={() => setDocumentDialog("adjustment")}>
                <SlidersHorizontal className="h-4 w-4" />
                {t("inventory.actions.adjustStock")}
              </Button>
              <Button onClick={openAddForm}>
                <Plus className="h-4 w-4" />
                {t("inventory.actions.addItem")}
              </Button>
            </div>
          }
        />

        <StatCards items={stats} />
      </div>

      <InventoryItemMobileList
        filters={filters}
        filtersOpen={filtersOpen}
        hasActiveFilters={hasActiveFilters}
        activeFilterCount={activeFilterCount}
        items={items}
        pageItems={pageItems}
        selectedIds={selectedIds}
        isLoading={isLoading}
        page={currentPage}
        totalPages={totalPages}
        onFiltersOpenChange={setFiltersOpen}
        onFiltersChange={setFilters}
        onResetFilters={resetFilters}
        onPageChange={setPage}
        onOpen={setViewItem}
        onEdit={openEditForm}
        onDelete={setDeleteTarget}
        onSelectedIdsChange={setSelectedIds}
        onNewReceipt={() => setDocumentDialog("receipt")}
        onNewDispatch={() => setDocumentDialog("dispatch")}
        onAdjustStock={() => setDocumentDialog("adjustment")}
        onAddItem={openAddForm}
      />

      <Card className="mt-6 hidden gap-0 md:block">
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
                placeholder={t("inventory.search.items")}
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={t("common.pagination.showingOf", {
                  count: filteredItems.length,
                  total: items.length,
                  noun: t("inventory.noun"),
                })}
                onClearAll={hasActiveFilters ? resetFilters : undefined}
              >
                <TableFilterSection label={t("inventory.filters.status")}>
                  <SearchableSelect
                    aria-label={t("inventory.filters.status")}
                    className="min-w-[12rem]"
                    value={filters.status}
                    onValueChange={(next) => {
                      setFilters((current) => ({
                        ...current,
                        status: next as InventoryFilterState["status"],
                      }));
                      setPage(1);
                    }}
                    searchPlaceholder={t("inventory.filters.allStatuses")}
                    options={[
                      { value: "all", label: t("inventory.filters.allStatuses") },
                      ...getInventoryStatusOptions(t),
                    ]}
                  />
                </TableFilterSection>

                <TableFilterSection label={t("inventory.filters.location")}>
                  <SearchableSelect
                    aria-label={t("inventory.filters.location")}
                    className="min-w-[12rem]"
                    value={filters.location}
                    onValueChange={(next) => {
                      setFilters((current) => ({
                        ...current,
                        location: next as InventoryFilterState["location"],
                      }));
                      setPage(1);
                    }}
                    searchPlaceholder={t("inventory.filters.allLocations")}
                    options={[
                      { value: "all", label: t("inventory.filters.allLocations") },
                      ...getInventoryLocationOptions(t),
                    ]}
                  />
                </TableFilterSection>

                <TableFilterSection label={t("inventory.filters.category")}>
                  <SearchableSelect
                    aria-label={t("inventory.filters.category")}
                    className="min-w-[12rem]"
                    value={filters.category}
                    onValueChange={(next) => {
                      setFilters((current) => ({
                        ...current,
                        category: next as InventoryFilterState["category"],
                      }));
                      setPage(1);
                    }}
                    searchPlaceholder={t("inventory.filters.allCategories")}
                    options={[
                      { value: "all", label: t("inventory.filters.allCategories") },
                      ...getInventoryCategoryOptions(t),
                    ]}
                  />
                </TableFilterSection>
              </TableFilterPanel>
            }
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={pageItems.map((item) => item.id)}
          totalCount={filteredItems.length}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const item = pageItems.find((entry) => entry.id === selectedIds[0]);
            if (item) openEditForm(item);
          }}
          onDelete={() => setDeleteTarget(items.filter((item) => selectedIds.includes(item.id)))}
        />

        {isLoading ? (
          <DirectoryTableLoader
            icon={Warehouse}
            title={t("inventory.loading.items.title")}
            description={t("inventory.loading.items.description")}
            columns={[t("inventory.columns.sku"), t("inventory.columns.item"), t("inventory.columns.available"), t("inventory.columns.location")]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageItems}
            page={currentPage}
            rowKey={(item) => item.id}
            rowLabel={(item) => item.sku}
            columnLayout={columnVisibility}
            sortUnavailable
            minWidth={1100}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewItem}
            onRowDoubleClick={openEditForm}
            activeRowId={viewItem?.id}
            emptyState={<p className="text-muted-foreground">{t("inventory.empty.items")}</p>}
          />
        )}

        {!isLoading ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", {
                count: pageItems.length,
                total: filteredItems.length,
                noun: t("inventory.noun"),
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
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
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                {t("common.actions.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <InventoryViewSheet
        item={viewItem}
        snapshot={snapshot}
        open={Boolean(viewItem)}
        onOpenChange={(open) => {
          if (!open) setViewItem(null);
        }}
        onEdit={openEditForm}
        onDelete={(item) => setDeleteTarget(item)}
      />

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="inset-x-0 bottom-0 top-auto flex h-[calc(100dvh-4rem)] max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 text-primary-foreground sm:bg-background sm:py-4 sm:text-foreground">
            <DialogTitle>
              {formMode === "edit" ? t("inventory.form.editItemTitle") : t("inventory.form.addItemTitle")}
            </DialogTitle>
          </DialogHeader>
          <InventoryItemForm
            key={editingItem?.id ?? "new"}
            initialValues={editingItem ? itemToFormValues(editingItem) : undefined}
            isEditing={formMode === "edit"}
            currentStock={editingItem?.quantity}
            unit={editingItem?.unit}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("inventory.actions.addItem")}
            onSubmit={saveItem}
            onCancel={() => setFormMode(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inventory.delete.itemsTitle")}</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("inventory.delete.itemsDescription", { count: deleteTarget.length })
                : t("inventory.delete.itemDescription", { name: deleteTarget?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton isPending={deleteItems.isPending} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={documentDialog === "receipt"} onOpenChange={(open) => !open && setDocumentDialog(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("inventory.form.newReceiptTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryReceiptForm
            items={items}
            submitLabel={t("inventory.actions.saveReceipt")}
            isSubmitting={createReceipt.isPending}
            onCancel={() => setDocumentDialog(null)}
            onSubmit={async (values) => {
              try {
                await createReceipt.mutateAsync(values);
                notifyAdded(t("inventory.references.receipt"), values.source);
                setDocumentDialog(null);
              } catch (error) {
                setFormError(toErrorMessage(error));
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={documentDialog === "dispatch"} onOpenChange={(open) => !open && setDocumentDialog(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("inventory.form.newDispatchTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryDispatchForm
            items={items}
            recipients={recipients}
            submitLabel={t("inventory.actions.saveDispatch")}
            secondarySubmitLabel={t("inventory.actions.saveAndSend")}
            isSubmitting={createDispatch.isPending}
            onCancel={() => setDocumentDialog(null)}
            onSubmit={async (values) => {
              try {
                await createDispatch.mutateAsync(values);
                notifyAdded(t("inventory.references.dispatch"), values.invoiceNumber || values.recipientId);
                setDocumentDialog(null);
              } catch (error) {
                setFormError(toErrorMessage(error));
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={documentDialog === "adjustment"} onOpenChange={(open) => !open && setDocumentDialog(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("inventory.form.adjustStockTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryAdjustmentForm
            items={items}
            submitLabel={t("inventory.actions.submitAdjustment")}
            isSubmitting={createAdjustment.isPending}
            onCancel={() => setDocumentDialog(null)}
            onSubmit={async (values) => {
              try {
                await createAdjustment.mutateAsync(values);
                const item = items.find((entry) => entry.id === values.itemId);
                notifyAdded(t("inventory.references.adjustment"), item?.name ?? "");
                setDocumentDialog(null);
              } catch (error) {
                setFormError(toErrorMessage(error));
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {formError ? (
        <div className="fixed bottom-4 right-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {formError}
        </div>
      ) : null}
    </div>
  );
}
