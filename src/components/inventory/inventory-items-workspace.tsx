"use client";

import { useMemo, useState } from "react";
import { Boxes, PackageCheck, Plus, SlidersHorizontal, Truck, Warehouse } from "lucide-react";

import { InventoryAdjustmentForm } from "@/components/inventory/inventory-adjustment-form";
import { InventoryDispatchForm } from "@/components/inventory/inventory-dispatch-form";
import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { InventoryItemMobileList } from "@/components/inventory/inventory-item-mobile-list";
import { InventoryReceiptForm } from "@/components/inventory/inventory-receipt-form";
import { InventoryViewSheet } from "@/components/inventory/inventory-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
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
import { useUserError } from "@/lib/errors";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { useTranslation } from "@/lib/i18n";
import {
  computeInventoryKpis,
  inventoryMatchesQuery,
} from "@/lib/inventory/display";
import {
  useCreateAdjustment,
  useCreateDispatch,
  useCreateInventoryItem,
  useCreateReceipt,
  useDeleteInventoryItems,
  useInventoryItems,
  useInventorySnapshotData,
  useInventorySuppliers,
  useUpdateInventoryItem,
} from "@/lib/inventory/hooks/use-inventory";
import {
  type InventoryFilterState,
  type InventoryFormValues,
  type InventoryItem,
  inventoryItemToFormValues,
} from "@/lib/inventory/types";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { buildTableSelectionResetKey, useTableSelectionReset } from "@/lib/table/directory-table-state";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { resolveClientTablePageLimit } from "@/lib/table/page-size";

const defaultFilters: InventoryFilterState = { query: "" };

type DocumentDialog = "receipt" | "dispatch" | "adjustment" | null;

export function InventoryItemsWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess } = useFeedback();
  const { data: items = [], isLoading, isError, error } = useInventoryItems();
  const { data: suppliers = [] } = useInventorySuppliers();
  const snapshot = useInventorySnapshotData();

  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const deleteItems = useDeleteInventoryItems();
  const createReceipt = useCreateReceipt();
  const createDispatch = useCreateDispatch();
  const createAdjustment = useCreateAdjustment();

  const [filters, setFilters] = useState<InventoryFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { page, setPage, pageSize, changePageSize } = useTablePageSize();
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | InventoryItem[] | null>(null);
  const [documentDialog, setDocumentDialog] = useState<DocumentDialog>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredItems = useMemo(
    () => items.filter((item) => inventoryMatchesQuery(item, filters.query)),
    [filters.query, items],
  );

  const kpis = useMemo(() => computeInventoryKpis(items), [items]);
  const listErrorMessage = isError ? toErrorMessage(error) : null;
  const pageLimit = resolveClientTablePageLimit(pageSize, filteredItems.length);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredItems.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);
  const allPageSelected = pageItems.length > 0 && pageItems.every((item) => selectedIds.includes(item.id));

  useTableSelectionReset(buildTableSelectionResetKey(filters.query), setSelectedIds);

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
        if (areFormValuesEquivalent(values, inventoryItemToFormValues(editingItem))) {
          notifySuccess(t("common.form.noChanges"));
          setFormMode(null);
          setEditingItem(null);
          return;
        }
        const nextItem = await updateItem.mutateAsync({ id: editingItem.id, values });
        notifyUpdated(t("inventory.entity"), nextItem.item);
      } else {
        const nextItem = await createItem.mutateAsync(values);
        notifyAdded(t("inventory.entity"), nextItem.item);
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
      label: t("inventory.stats.outOfStock.label"),
      value: kpis.outOfStock.toString(),
      description: t("inventory.stats.outOfStock.description"),
      icon: Warehouse,
    },
    {
      label: t("inventory.stats.totalUnits.label"),
      value: kpis.totalUnits.toString(),
      description: t("inventory.stats.totalUnits.description"),
      icon: Boxes,
    },
  ];

  const tableColumns: DataTableColumn<InventoryItem>[] = [
    { id: "item", label: t("inventory.columns.item"), cellClassName: "font-medium", renderCell: (item) => item.item },
    { id: "quantityLeft", label: t("inventory.columns.quantityLeft"), renderCell: (item) => item.quantity },
    {
      id: "reorderThreshold",
      label: t("inventory.columns.reorderThreshold"),
      renderCell: (item) => item.reorderThreshold,
    },
  ];

  const columnVisibility = useColumnVisibility("inventory-items", tableColumns);
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: Boolean(filters.query.trim()),
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
        query={filters.query}
        items={items}
        pageItems={pageItems}
        selectedIds={selectedIds}
        isLoading={isLoading}
        page={currentPage}
        totalPages={totalPages}
        onQueryChange={(query) => {
          setFilters({ query });
          setPage(1);
        }}
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

      {listErrorMessage ? <p className="mt-4 text-sm text-destructive md:hidden">{listErrorMessage}</p> : null}

      <Card className="mt-6 hidden gap-0 md:flex">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            showFilterToggle={false}
            columnLayout={columnVisibility}
            searchSummary={searchSummary}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters({ query });
                  setPage(1);
                }}
                placeholder={t("inventory.search.items")}
              />
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

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={Warehouse}
            title={t("inventory.loading.items.title")}
            description={t("inventory.loading.items.description")}
            columns={[
              t("inventory.columns.item"),
              t("inventory.columns.quantityLeft"),
              t("inventory.columns.reorderThreshold"),
            ]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageItems}
            page={currentPage}
            rowKey={(row) => row.id}
            rowLabel={(row) => row.item}
            columnLayout={columnVisibility}
            sortUnavailable
            minWidth={800}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={(checked) => {
              if (checked) {
                setSelectedIds((current) => Array.from(new Set([...current, ...pageItems.map((item) => item.id)])));
              } else {
                setSelectedIds((current) => current.filter((id) => !pageItems.some((item) => item.id === id)));
              }
            }}
            onToggleSelect={(id, checked) => {
              setSelectedIds((current) => (checked ? [...current, id] : current.filter((entry) => entry !== id)));
            }}
            onRowClick={setViewItem}
            onRowDoubleClick={openEditForm}
            activeRowId={viewItem?.id}
            emptyState={<p className="text-muted-foreground">{t("inventory.empty.items")}</p>}
          />
        )}

        {!isLoading && !listErrorMessage ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", {
                count: pageItems.length,
                total: filteredItems.length,
                noun: t("inventory.noun"),
              })}
            </p>
            <TablePaginationControls
              page={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={changePageSize}
            />
          </div>
        ) : null}
      </Card>

      <InventoryViewSheet
        item={viewItem}
        snapshot={snapshot}
        open={Boolean(viewItem)}
        onOpenChange={(open) => !open && setViewItem(null)}
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
            initialValues={editingItem ? inventoryItemToFormValues(editingItem) : undefined}
            quantityLeft={editingItem?.quantity ?? 0}
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
                : t("inventory.delete.itemDescription", { name: deleteTarget?.item ?? "" })}
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
            suppliers={suppliers}
            submitLabel={t("inventory.actions.saveReceipt")}
            isSubmitting={createReceipt.isPending}
            onCancel={() => setDocumentDialog(null)}
            onSubmit={async (values) => {
              try {
                await createReceipt.mutateAsync(values);
                const item = items.find((entry) => entry.id === values.itemId);
                notifyAdded(t("inventory.references.receipt"), item?.item ?? values.itemId);
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
            submitLabel={t("inventory.actions.saveDispatch")}
            isSubmitting={createDispatch.isPending}
            onCancel={() => setDocumentDialog(null)}
            onSubmit={async (values) => {
              try {
                await createDispatch.mutateAsync(values);
                const item = items.find((entry) => entry.id === values.itemId);
                notifyAdded(t("inventory.references.dispatch"), item?.item ?? values.itemId);
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
                notifyAdded(t("inventory.references.adjustment"), item?.item ?? "");
                setDocumentDialog(null);
              } catch (error) {
                setFormError(toErrorMessage(error));
              }
            }}
          />
        </DialogContent>
      </Dialog>
      {formError ? <p className="sr-only">{formError}</p> : null}
    </div>
  );
}
