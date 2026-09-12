"use client";

import { useMemo, useState } from "react";
import { Building2, Plus } from "lucide-react";

import { InventorySupplierForm } from "@/components/inventory/inventory-supplier-form";
import { InventorySupplierMobileList } from "@/components/inventory/inventory-supplier-mobile-list";
import { InventorySupplierViewSheet } from "@/components/inventory/inventory-supplier-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
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
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";
import { useTranslation } from "@/lib/i18n";
import { formatSupplierList, formatSupplierPhones, supplierMatchesQuery } from "@/lib/inventory/display";
import {
  useCreateSupplier,
  useDeleteSuppliers,
  useInventorySnapshotData,
  useInventorySuppliers,
  useUpdateSupplier,
} from "@/lib/inventory/hooks/use-inventory";
import {
  createEmptySupplierForm,
  supplierToFormValues,
  type InventorySupplier,
  type SupplierFormValues,
} from "@/lib/inventory/types/suppliers";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { buildTableSelectionResetKey, useTableSelectionReset } from "@/lib/table/directory-table-state";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { resolveClientTablePageLimit } from "@/lib/table/page-size";

export function InventorySuppliersWorkspace() {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const { toErrorMessage } = useUserError();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess, notifyError } = useFeedback();
  const { data: suppliers = [], isLoading, isError, error } = useInventorySuppliers();
  const snapshot = useInventorySnapshotData();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSuppliers = useDeleteSuppliers();

  const [query, setQuery] = useState("");
  const { page, setPage, pageSize, changePageSize } = useTablePageSize();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventorySupplier | InventorySupplier[] | null>(null);
  const [viewSupplier, setViewSupplier] = useState<InventorySupplier | null>(null);

  useTableSelectionReset(buildTableSelectionResetKey(query), setSelectedIds);

  const filtered = useMemo(
    () => suppliers.filter((supplier) => supplierMatchesQuery(supplier, query)),
    [query, suppliers],
  );

  const pageLimit = resolveClientTablePageLimit(pageSize, filtered.length);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageLimit, currentPage * pageLimit);
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id));
  const listErrorMessage = isError ? toErrorMessage(error) : null;

  const columns: DataTableColumn<InventorySupplier>[] = [
    {
      id: "companyName",
      label: t("inventory.form.fields.companyName"),
      cellClassName: "font-medium",
      renderCell: (row) => row.companyName,
    },
    {
      id: "contactNames",
      label: t("inventory.form.fields.contactNames"),
      renderCell: (row) => formatSupplierList(row.contactNames) || dash,
    },
    {
      id: "addresses",
      label: t("inventory.form.fields.addresses"),
      renderCell: (row) => formatSupplierList(row.addresses) || dash,
    },
    {
      id: "phones",
      label: t("inventory.form.fields.phones"),
      renderCell: (row) => formatSupplierPhones(row) || dash,
    },
    {
      id: "emails",
      label: t("inventory.form.fields.emails"),
      renderCell: (row) => formatSupplierList(row.emails) || dash,
    },
  ];

  const columnVisibility = useColumnVisibility("inventory-suppliers", columns);
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: Boolean(query.trim()),
    query,
    matched: filtered.length,
    catalogTotal: suppliers.length,
    noun: t("inventory.submenus.suppliers").toLowerCase(),
  });

  function openAddForm() {
    setEditingSupplier(null);
    setFormMode("add");
  }

  function openEditForm(supplier: InventorySupplier) {
    setEditingSupplier(supplier);
    setFormMode("edit");
    setViewSupplier(null);
  }

  async function saveSupplier(values: SupplierFormValues) {
    try {
      if (formMode === "edit" && editingSupplier) {
        if (areFormValuesEquivalent(values, supplierToFormValues(editingSupplier))) {
          notifySuccess(t("common.form.noChanges"));
          setFormMode(null);
          setEditingSupplier(null);
          return;
        }
        const updated = await updateSupplier.mutateAsync({ id: editingSupplier.id, values });
        notifyUpdated(t("inventory.submenus.suppliers"), updated.companyName);
      } else {
        const created = await createSupplier.mutateAsync(values);
        notifyAdded(t("inventory.submenus.suppliers"), created.companyName);
      }
      setFormMode(null);
      setEditingSupplier(null);
    } catch (error) {
      window.alert(toErrorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((row) => row.id) : [deleteTarget.id];
    try {
      const result = await deleteSuppliers.mutateAsync(ids);

      reportBulkSettled({
        result,
        t,
        entityLabel: t("inventory.submenus.suppliers"),
        notifyDeleted,
        notifyError,
        onAllFailed: (message) => {
          notifyError(message);
        },
        onDone: () => {
          setSelectedIds((current) => current.filter((id) => !result.succeededIds.includes(id)));
          setDeleteTarget(null);
          setViewSupplier(null);
        },
      });
    } catch (mutationError) {
      notifyError(toErrorMessage(mutationError));
    }
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="hidden md:block">
        <PageHeader
          title={t("inventory.submenus.suppliers")}
          description={t("inventory.pages.suppliers")}
          actions={
            <Button onClick={openAddForm}>
              <Plus className="h-4 w-4" />
              {t("inventory.actions.addSupplier")}
            </Button>
          }
        />
      </div>

      <InventorySupplierMobileList
        query={query}
        suppliers={suppliers}
        pageRows={pageRows}
        selectedIds={selectedIds}
        isLoading={isLoading}
        page={currentPage}
        totalPages={totalPages}
        onQueryChange={setQuery}
        onPageChange={setPage}
        onOpen={setViewSupplier}
        onEdit={openEditForm}
        onDelete={setDeleteTarget}
        onSelectedIdsChange={setSelectedIds}
        onAddSupplier={openAddForm}
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
                placeholder={t("inventory.search.suppliers")}
              />
            }
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={pageRows.map((row) => row.id)}
          totalCount={filtered.length}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const supplier = pageRows.find((row) => row.id === selectedIds[0]);
            if (supplier) openEditForm(supplier);
          }}
          onDelete={() => setDeleteTarget(suppliers.filter((row) => selectedIds.includes(row.id)))}
        />

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={Building2}
            title={t("inventory.loading.suppliers.title")}
            description={t("inventory.loading.suppliers.description")}
            columns={[
              t("inventory.form.fields.companyName"),
              t("inventory.form.fields.contactNames"),
              t("inventory.form.fields.phones"),
            ]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageRows}
            page={currentPage}
            rowKey={(row) => row.id}
            rowLabel={(row) => row.companyName}
            columnLayout={columnVisibility}
            sortUnavailable
            minWidth={900}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={(checked) => {
              if (checked) {
                setSelectedIds((current) => Array.from(new Set([...current, ...pageRows.map((row) => row.id)])));
              } else {
                setSelectedIds((current) => current.filter((id) => !pageRows.some((row) => row.id === id)));
              }
            }}
            onToggleSelect={(id, checked) => {
              setSelectedIds((current) => (checked ? [...current, id] : current.filter((entry) => entry !== id)));
            }}
            onRowClick={setViewSupplier}
            onRowDoubleClick={openEditForm}
            activeRowId={viewSupplier?.id}
            emptyState={<p className="text-muted-foreground">{t("inventory.empty.suppliers")}</p>}
          />
        )}

        {!isLoading && !listErrorMessage ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", {
                count: pageRows.length,
                total: filtered.length,
                noun: t("inventory.submenus.suppliers").toLowerCase(),
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

      <InventorySupplierViewSheet
        supplier={viewSupplier}
        snapshot={snapshot}
        open={Boolean(viewSupplier)}
        onOpenChange={(open) => !open && setViewSupplier(null)}
        onEdit={openEditForm}
        onDelete={(supplier) => setDeleteTarget(supplier)}
      />

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="inset-x-0 bottom-0 top-auto flex h-[calc(100dvh-4rem)] max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 text-primary-foreground sm:bg-background sm:py-4 sm:text-foreground">
            <DialogTitle>
              {formMode === "edit" ? t("inventory.form.editSupplierTitle") : t("inventory.form.addSupplierTitle")}
            </DialogTitle>
          </DialogHeader>
          <InventorySupplierForm
            key={editingSupplier?.id ?? "new"}
            initialValues={editingSupplier ? supplierToFormValues(editingSupplier) : createEmptySupplierForm()}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("inventory.actions.addSupplier")}
            isSubmitting={createSupplier.isPending || updateSupplier.isPending}
            onSubmit={saveSupplier}
            onCancel={() => setFormMode(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inventory.delete.suppliersTitle")}</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("inventory.delete.suppliersDescription", { count: deleteTarget.length })
                : t("inventory.delete.supplierDescription", { name: deleteTarget?.companyName ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton isPending={deleteSuppliers.isPending} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
