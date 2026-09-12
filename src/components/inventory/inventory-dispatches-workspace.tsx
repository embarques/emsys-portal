"use client";

import { useMemo, useState } from "react";
import { Plus, Truck } from "lucide-react";

import { InventoryDispatchForm } from "@/components/inventory/inventory-dispatch-form";
import { InventoryDispatchMobileList } from "@/components/inventory/inventory-dispatch-mobile-list";
import { InventoryDispatchViewSheet } from "@/components/inventory/inventory-dispatch-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { formatInventoryDate, formatInventoryMoney, getInventoryDispatchToLabel, getDispatchItemLabel, dispatchMatchesQuery } from "@/lib/inventory/display";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateDispatch,
  useDeleteDispatches,
  useInventoryDispatches,
  useInventoryItems,
  useUpdateDispatch,
} from "@/lib/inventory/hooks/use-inventory";
import { dispatchToFormValues, type DispatchFormValues, type InventoryDispatch } from "@/lib/inventory/types/documents";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { resolveClientTablePageLimit } from "@/lib/table/page-size";
import { buildTableSelectionResetKey, useTableSelectionReset } from "@/lib/table/directory-table-state";

export function InventoryDispatchesWorkspace() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { toErrorMessage } = useUserError();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess } = useFeedback();
  const { data: dispatches = [], isLoading, isError, error } = useInventoryDispatches();
  const { data: items = [] } = useInventoryItems();
  const createDispatch = useCreateDispatch();
  const updateDispatch = useUpdateDispatch();
  const deleteDispatches = useDeleteDispatches();
  const canCreate = hasPermission(PERMISSIONS.inventoryDispatchesCreate.name, PERMISSIONS.inventoryDispatchesCreate.resourceType);
  const canUpdate = hasPermission(PERMISSIONS.inventoryDispatchesUpdate.name, PERMISSIONS.inventoryDispatchesUpdate.resourceType);
  const canDelete = hasPermission(PERMISSIONS.inventoryDispatchesDelete.name, PERMISSIONS.inventoryDispatchesDelete.resourceType);

  const [query, setQuery] = useState("");
  const { page, setPage, pageSize, changePageSize } = useTablePageSize();
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingDispatch, setEditingDispatch] = useState<InventoryDispatch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryDispatch | InventoryDispatch[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewDispatch, setViewDispatch] = useState<InventoryDispatch | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return dispatches;
    return dispatches.filter((dispatch) => {
      return dispatchMatchesQuery(dispatch, getDispatchItemLabel(dispatch, items), normalized);
    });
  }, [dispatches, items, query]);

  const pageLimit = resolveClientTablePageLimit(pageSize, filtered.length);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);
  const listErrorMessage = isError ? toErrorMessage(error) : null;
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id));
  useTableSelectionReset(buildTableSelectionResetKey(query), setSelectedIds);

  function openAddForm() {
    if (!canCreate) return;
    setEditingDispatch(null);
    setFormMode("add");
  }

  function openEditForm(dispatch: InventoryDispatch) {
    if (!canUpdate) return;
    setEditingDispatch(dispatch);
    setViewDispatch(null);
    setFormMode("edit");
  }

  async function saveDispatch(values: DispatchFormValues) {
    try {
      if (formMode === "edit" && editingDispatch) {
        if (areFormValuesEquivalent(values, dispatchToFormValues(editingDispatch))) {
          notifySuccess(t("common.form.noChanges"));
          setFormMode(null);
          return;
        }
        const updated = await updateDispatch.mutateAsync({ id: editingDispatch.id, values });
        notifyUpdated(t("inventory.references.dispatch"), getDispatchItemLabel(updated, items));
      } else {
        const created = await createDispatch.mutateAsync(values);
        notifyAdded(t("inventory.references.dispatch"), getDispatchItemLabel(created, items));
      }
      setFormMode(null);
      setEditingDispatch(null);
    } catch (mutationError) {
      window.alert(toErrorMessage(mutationError));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((row) => row.id) : [deleteTarget.id];
    try {
      const result = await deleteDispatches.mutateAsync(ids);
      notifyDeleted(t("inventory.references.dispatch"), result.succeededIds.length);
      setSelectedIds((current) => current.filter((id) => !result.succeededIds.includes(id)));
      setDeleteTarget(null);
      setViewDispatch(null);
    } catch (mutationError) {
      window.alert(toErrorMessage(mutationError));
    }
  }

  const columns: DataTableColumn<InventoryDispatch>[] = [
    {
      id: "item",
      label: t("inventory.columns.item"),
      renderCell: (row) => getDispatchItemLabel(row, items),
    },
    { id: "quantity", label: t("inventory.form.fields.quantityDispatched"), renderCell: (row) => row.quantity },
    {
      id: "dispatchedTo",
      label: t("inventory.columns.dispatchedTo"),
      renderCell: (row) => getInventoryDispatchToLabel(row.dispatchedTo),
    },
    { id: "incomeGained", label: t("inventory.columns.incomeGained"), renderCell: (row) => formatInventoryMoney(row.incomeGained) },
    { id: "date", label: t("inventory.columns.date"), renderCell: (row) => formatInventoryDate(row.dispatchedAt) },
  ];

  const columnVisibility = useColumnVisibility("inventory-dispatches", columns);
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: Boolean(query.trim()),
    query,
    matched: filtered.length,
    catalogTotal: dispatches.length,
    noun: t("inventory.submenus.dispatches").toLowerCase(),
  });

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="hidden md:block">
        <PageHeader
          title={t("inventory.submenus.dispatches")}
          description={t("inventory.pages.dispatches")}
          actions={
          canCreate ? <Button onClick={openAddForm}>
              <Plus className="h-4 w-4" />
              {t("inventory.actions.newDispatch")}
            </Button> : null
          }
        />
      </div>

      <InventoryDispatchMobileList
        query={query}
        pageRows={pageRows}
        items={items}
        isLoading={isLoading}
        page={currentPage}
        totalPages={totalPages}
        onQueryChange={setQuery}
        onPageChange={setPage}
        onOpen={setViewDispatch}
        onAddDispatch={openAddForm}
        onEdit={canUpdate ? openEditForm : undefined}
        onDelete={canDelete ? setDeleteTarget : undefined}
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
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(1);
                }}
                placeholder={t("inventory.search.dispatches")}
              />
            }
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={pageRows.map((row) => row.id)}
          totalCount={filtered.length}
          onSelectedIdsChange={setSelectedIds}
          onEdit={canUpdate ? () => {
            const row = pageRows.find((entry) => entry.id === selectedIds[0]);
            if (row) openEditForm(row);
          } : undefined}
          onDelete={canDelete ? () => setDeleteTarget(dispatches.filter((row) => selectedIds.includes(row.id))) : undefined}
        />

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={Truck}
            title={t("inventory.loading.dispatches.title")}
            description={t("inventory.loading.dispatches.description")}
            columns={[t("inventory.columns.item"), t("inventory.form.fields.quantityDispatched"), t("inventory.columns.date")]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageRows}
            page={currentPage}
            rowKey={(row) => row.id}
            rowLabel={(row) => getDispatchItemLabel(row, items)}
            columnLayout={columnVisibility}
            sortUnavailable
            minWidth={800}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={(checked) =>
              setSelectedIds((current) =>
                checked
                  ? Array.from(new Set([...current, ...pageRows.map((row) => row.id)]))
                  : current.filter((id) => !pageRows.some((row) => row.id === id)),
              )
            }
            onToggleSelect={(id, checked) =>
              setSelectedIds((current) => (checked ? [...current, id] : current.filter((entry) => entry !== id)))
            }
            onRowClick={setViewDispatch}
            onRowDoubleClick={canUpdate ? openEditForm : undefined}
            activeRowId={viewDispatch?.id}
            emptyState={<p className="text-muted-foreground">{t("inventory.empty.dispatches")}</p>}
          />
        )}

        {!isLoading && !listErrorMessage ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", {
                count: pageRows.length,
                total: filtered.length,
                noun: t("inventory.submenus.dispatches").toLowerCase(),
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

      <InventoryDispatchViewSheet
        dispatch={viewDispatch}
        items={items}
        open={Boolean(viewDispatch)}
        onOpenChange={(open) => !open && setViewDispatch(null)}
        onEdit={canUpdate ? openEditForm : undefined}
        onDelete={canDelete ? setDeleteTarget : undefined}
      />

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="inset-x-0 bottom-0 top-auto flex h-[calc(100dvh-4rem)] max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 text-primary-foreground sm:bg-background sm:py-4 sm:text-foreground">
            <DialogTitle>{formMode === "edit" ? t("common.actions.edit") : t("inventory.form.newDispatchTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryDispatchForm
            items={items}
            initialValues={editingDispatch ? dispatchToFormValues(editingDispatch) : undefined}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("inventory.actions.saveDispatch")}
            isSubmitting={createDispatch.isPending || updateDispatch.isPending}
            onCancel={() => setFormMode(null)}
            onSubmit={saveDispatch}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.actions.delete")}</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `${deleteTarget.length} ${t("inventory.submenus.dispatches").toLowerCase()}`
                : deleteTarget
                  ? getDispatchItemLabel(deleteTarget, items)
                  : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t("common.actions.cancel")}</Button>
            <ConfirmDeleteButton isPending={deleteDispatches.isPending} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
