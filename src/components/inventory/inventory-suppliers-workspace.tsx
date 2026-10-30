"use client";

import { useMemo, useState } from "react";
import { Archive, Building2, Plus } from "lucide-react";

import { InventoryActiveToggleDialog, type InventoryActiveToggleTarget } from "@/components/inventory/inventory-active-toggle-dialog";
import { InventoryActiveBadge } from "@/components/inventory/inventory-status-badge";
import { InventorySupplierForm } from "@/components/inventory/inventory-supplier-form";
import { InventorySupplierMobileList } from "@/components/inventory/inventory-supplier-mobile-list";
import { InventorySupplierViewSheet } from "@/components/inventory/inventory-supplier-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableAdvancedFilterPanel } from "@/components/app-shell/table-advanced-filter-panel";
import { useApiTableColumns } from "@/components/app-shell/use-api-table-columns";
import { INVENTORY_SUPPLIER_API_TABLE_FIELDS } from "@/lib/inventory/suppliers/table-fields";
import {
  INVENTORY_SUPPLIER_TABLE_FILTER_FIELDS,
  localizeInventoryFilterOption,
} from "@/lib/inventory/filter-fields";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { createInventorySearchFilter, DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS } from "@/lib/inventory/types/list";
import { countCompleteFilterRows, type TableFilterRowState } from "@/lib/table/filter-builder";
import { useLocalizedFilterFields } from "@/lib/table/hooks/use-localized-filter-fields";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserError } from "@/lib/errors";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";
import { useTranslation } from "@/lib/i18n";
import {
  formatSupplierContactNames,
  formatSupplierEmails,
  formatSupplierList,
  formatSupplierPhones,
} from "@/lib/inventory/display";
import {
  useCreateSupplier,
  useInventorySnapshotData,
  useInventoryDirectoryPage,
  useInventorySuppliers,
  useSetSuppliersActive,
  useUpdateSupplier,
} from "@/lib/inventory/hooks/use-inventory";
import {
  supplierToFormValues,
  type InventorySupplier,
  type SupplierFormValues,
} from "@/lib/inventory/types/suppliers";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";

const SEARCH_DEBOUNCE_MS = 300;

export function InventorySuppliersWorkspace() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const dash = t("common.empty.dash");
  const { toErrorMessage } = useUserError();
  const { notifyAdded, notifyUpdated, notifySuccess, notifyError } = useFeedback();
  const { data: suppliers = [], isError, error } = useInventorySuppliers();
  const snapshot = useInventorySnapshotData();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const setSuppliersActive = useSetSuppliersActive();
  const canCreate = hasPermission(PERMISSIONS.inventorySuppliersCreate.name, PERMISSIONS.inventorySuppliersCreate.resourceType);
  const canUpdate = hasPermission(PERMISSIONS.inventorySuppliersUpdate.name, PERMISSIONS.inventorySuppliersUpdate.resourceType);

  const [query, setQuery] = useState("");
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS.sort, () => setPage(1));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null);
  const [toggleTarget, setToggleTarget] = useState<InventoryActiveToggleTarget<InventorySupplier>>(null);
  const [viewSupplier, setViewSupplier] = useState<InventorySupplier | null>(null);

  const [filterRows, setFilterRows] = useState<TableFilterRowState[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterFields = useLocalizedFilterFields(
    INVENTORY_SUPPLIER_TABLE_FILTER_FIELDS,
    "inventory.filters.suppliers.fields",
    localizeInventoryFilterOption,
  );
  const activeFilterCount = countCompleteFilterRows(filterRows, filterFields);
  const hasActiveFilters = Boolean(query.trim()) || activeFilterCount > 0;


  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const directoryParams = useMemo(
    () => ({
      ...DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS,
      page,
      limit: pageLimit,
      sort,
      search: createInventorySearchFilter(debouncedQuery),
      ...(filterRows.length ? { filterRows } : {}),
    }),
    [debouncedQuery, filterRows, page, pageLimit, sort],
  );
  useTableSelectionReset(buildTableSelectionResetKey(debouncedQuery, filterRows), setSelectedIds);
  const directoryQuery = useInventoryDirectoryPage("suppliers", directoryParams);
  const pageRows = useResolvedPaginatedItems(directoryQuery.data?.items, directoryQuery.data?.total, directoryQuery.isFetching);
  const totalMatched = directoryQuery.data?.total ?? 0;
  rememberTotal(totalMatched);
  const totalPages = Math.max(1, Math.ceil(totalMatched / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.includes(row.id));
  const isLoading = directoryQuery.isLoading;
  const listErrorMessage = directoryQuery.isError
    ? toErrorMessage(directoryQuery.error)
    : isError
      ? toErrorMessage(error)
      : null;
  const selectedActive = suppliers.filter((row) => selectedIds.includes(row.id) && row.isActive);
  const editingSupplierValues = useMemo(() => (editingSupplier ? supplierToFormValues(editingSupplier) : undefined), [editingSupplier]);

  const columns: DataTableColumn<InventorySupplier>[] = [
    {
      id: "companyName",
      label: t("inventory.form.fields.companyName"),
      cellClassName: "font-medium",
      renderCell: (row) => row.companyName,
    },
    { id: "contacts", label: t("inventory.columns.contacts"), sortable: false, renderCell: (row) => formatSupplierContactNames(row) || dash },
    { id: "phones", label: t("inventory.form.fields.phones"), sortable: false, renderCell: (row) => formatSupplierPhones(row) || dash },
    { id: "emails", label: t("inventory.form.fields.emails"), sortable: false, renderCell: (row) => formatSupplierEmails(row) || dash },
    { id: "addresses", label: t("inventory.form.fields.addresses"), sortable: false, renderCell: (row) => formatSupplierList(row.addresses) || dash },
    { id: "status", label: t("inventory.columns.status"), sortField: "isActive", renderCell: (row) => <InventoryActiveBadge isActive={row.isActive} /> },
  ];

  const columnVisibility = useApiTableColumns("inventory-suppliers", columns, INVENTORY_SUPPLIER_API_TABLE_FIELDS);
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query,
    matched: totalMatched,
    catalogTotal: suppliers.length,
    noun: t("inventory.submenus.suppliers").toLowerCase(),
  });

  function openAddForm() {
    if (!canCreate) return;
    setEditingSupplier(null);
    setFormMode("add");
  }

  function openEditForm(supplier: InventorySupplier) {
    if (!canUpdate) return;
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
        const updated = await updateSupplier.mutateAsync({ supplier: editingSupplier, values });
        notifyUpdated(t("inventory.submenus.suppliers"), updated.companyName);
      } else {
        const created = await createSupplier.mutateAsync(values);
        notifyAdded(t("inventory.submenus.suppliers"), created.companyName);
      }
      setFormMode(null);
      setEditingSupplier(null);
    } catch (saveError) {
      notifyError(toErrorMessage(saveError));
    }
  }

  async function confirmToggleActive() {
    if (!toggleTarget) return;
    try {
      const result = await setSuppliersActive.mutateAsync({
        suppliers: toggleTarget.records,
        isActive: toggleTarget.isActive,
      });
      reportBulkSettled({
        result,
        t,
        notifyError,
        onSucceeded: (count) =>
          notifySuccess(
            t(toggleTarget.isActive ? "inventory.toasts.reactivated" : "inventory.toasts.deactivated", { count }),
          ),
        onAllFailed: notifyError,
        onDone: () => {
          setSelectedIds((current) => current.filter((id) => !result.succeededIds.includes(id)));
          setToggleTarget(null);
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
            canCreate ? <Button onClick={openAddForm}>
              <Plus className="h-4 w-4" />
              {t("inventory.actions.addSupplier")}
            </Button> : null
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
        onEdit={canUpdate ? openEditForm : undefined}
        onDeactivate={
          canUpdate
            ? (target) => setToggleTarget({ records: Array.isArray(target) ? target : [target], isActive: false })
            : undefined
        }
        onSelectedIdsChange={setSelectedIds}
        onAddSupplier={openAddForm}
      />

      {listErrorMessage ? <p className="mt-4 text-sm text-destructive md:hidden">{listErrorMessage}</p> : null}

      <Card className="mt-6 hidden gap-0 md:flex">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            filterPanel={
              <TableAdvancedFilterPanel
                presetScope="inventory-suppliers"
                open={filtersOpen}
                rows={filterRows}
                fields={filterFields}
                onRowsChange={(rows) => {
                  setFilterRows(rows);
                  setPage(1);
                }}
                onClearAll={
                  hasActiveFilters
                    ? () => {
                        setQuery("");
                        setFilterRows([]);
                        setPage(1);
                      }
                    : undefined
                }
              />
            }
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
          totalCount={totalMatched}
          onSelectedIdsChange={setSelectedIds}
          onEdit={canUpdate ? () => {
            const supplier = pageRows.find((row) => row.id === selectedIds[0]);
            if (supplier) openEditForm(supplier);
          } : undefined}
          onDelete={canUpdate ? () => setToggleTarget({ records: selectedActive, isActive: false }) : undefined}
          deleteDisabled={selectedActive.length === 0}
          deleteLabel={t("inventory.actions.deactivate")}
          deleteIcon={<Archive className="size-4" />}
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
              t("inventory.columns.contacts"),
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
            sort={sort}
            onSortChange={onSortChange}
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
            onRowDoubleClick={canUpdate ? openEditForm : undefined}
            activeRowId={viewSupplier?.id}
            emptyState={<p className="text-muted-foreground">{t("inventory.empty.suppliers")}</p>}
          />
        )}

        {!isLoading && !listErrorMessage ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", {
                count: pageRows.length,
                total: totalMatched,
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
        onEdit={canUpdate ? openEditForm : undefined}
        onToggleActive={
          canUpdate ? (supplier) => setToggleTarget({ records: [supplier], isActive: !supplier.isActive }) : undefined
        }
      />

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="inset-x-0 bottom-0 top-auto flex h-[calc(100dvh-4rem)] max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 text-primary-foreground sm:bg-background sm:py-4 sm:text-foreground">
            <DialogTitle>
              {formMode === "edit" ? t("inventory.form.editSupplierTitle") : t("inventory.form.addSupplierTitle")}
            </DialogTitle>
          </DialogHeader>
          <InventorySupplierForm
            key={editingSupplier?.id ?? "new"}
            initialValues={editingSupplierValues}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("inventory.actions.addSupplier")}
            isSubmitting={createSupplier.isPending || updateSupplier.isPending}
            onSubmit={saveSupplier}
            onCancel={() => setFormMode(null)}
          />
        </DialogContent>
      </Dialog>

      <InventoryActiveToggleDialog
        target={toggleTarget}
        copyKey="inventory.activeToggle.suppliers"
        getName={(supplier) => supplier.companyName}
        isPending={setSuppliersActive.isPending}
        onConfirm={confirmToggleActive}
        onOpenChange={(open) => !open && setToggleTarget(null)}
      />
    </div>
  );
}
