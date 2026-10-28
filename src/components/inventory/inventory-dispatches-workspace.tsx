"use client";

import { useMemo, useState } from "react";
import { Plus, Truck } from "lucide-react";

import { InventoryDispatchForm } from "@/components/inventory/inventory-dispatch-form";
import { InventoryDispatchViewSheet } from "@/components/inventory/inventory-dispatch-view-sheet";
import { InventoryDocumentCommandDialog, type InventoryDocumentCommand } from "@/components/inventory/inventory-document-command-dialog";
import { InventoryDocumentMobileList } from "@/components/inventory/inventory-document-mobile-list";
import { InventoryDocumentMobileRow } from "@/components/inventory/inventory-document-mobile-row";
import { InventoryDocumentStatusBadge } from "@/components/inventory/inventory-status-badge";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableAdvancedFilterPanel } from "@/components/app-shell/table-advanced-filter-panel";
import { useApiTableColumns } from "@/components/app-shell/use-api-table-columns";
import { INVENTORY_DISPATCH_API_TABLE_FIELDS } from "@/lib/inventory/dispatches/table-fields";
import {
  INVENTORY_DISPATCH_TABLE_FILTER_FIELDS,
  INVENTORY_FILTER_OPTION_SOURCES,
  localizeInventoryFilterOption,
  matchReferenceIds,
} from "@/lib/inventory/filter-fields";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useResolvedPaginatedItems } from "@/lib/table/directory-table-state";
import { createInventorySearchFilter, DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS } from "@/lib/inventory/types/list";
import { countCompleteFilterRows, type TableFilterRowState } from "@/lib/table/filter-builder";
import { useLocalizedFilterFields } from "@/lib/table/hooks/use-localized-filter-fields";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import {
  formatInventoryDateTime,
  getHolderNameById,
  summarizeDocumentLines,
} from "@/lib/inventory/display";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import {
  useCancelDispatch,
  useCreateDispatch,
  useInventoryDirectoryPage,
  useInventoryDispatches,
  useInventoryHolders,
  useInventoryItems,
  usePostDispatch,
  useUpdateDispatch,
} from "@/lib/inventory/hooks/use-inventory";
import {
  dispatchToFormValues,
  sumLineQuantities,
  type DispatchFormValues,
  type InventoryDispatch,
} from "@/lib/inventory/types/documents";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";

const SEARCH_DEBOUNCE_MS = 300;

export function InventoryDispatchesWorkspace() {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const { hasPermission } = useAuth();
  const { toErrorMessage } = useUserError();
  const { notifyAdded, notifyUpdated, notifySuccess, notifyError } = useFeedback();
  const { data: dispatches = [], isError, error } = useInventoryDispatches();
  const { data: items = [] } = useInventoryItems();
  const { data: holders = [] } = useInventoryHolders();
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc" });
  const createDispatch = useCreateDispatch();
  const updateDispatch = useUpdateDispatch();
  const postDispatch = usePostDispatch();
  const cancelDispatch = useCancelDispatch();
  const canCreate = hasPermission(PERMISSIONS.inventoryDispatchesCreate.name, PERMISSIONS.inventoryDispatchesCreate.resourceType);
  const canUpdate = hasPermission(PERMISSIONS.inventoryDispatchesUpdate.name, PERMISSIONS.inventoryDispatchesUpdate.resourceType);

  const [query, setQuery] = useState("");
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS.sort, () => setPage(1));
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingDispatch, setEditingDispatch] = useState<InventoryDispatch | null>(null);
  const [viewDispatch, setViewDispatch] = useState<InventoryDispatch | null>(null);
  const [commandTarget, setCommandTarget] = useState<{ command: InventoryDocumentCommand; dispatch: InventoryDispatch } | null>(null);

  const employeeNames = useMemo(
    () => new Map((employeesQuery.data?.items ?? []).map((employee) => [String(employee.id), employee.name])),
    [employeesQuery.data?.items],
  );

  const [filterRows, setFilterRows] = useState<TableFilterRowState[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterFields = useLocalizedFilterFields(
    INVENTORY_DISPATCH_TABLE_FILTER_FIELDS,
    "inventory.filters.dispatches.fields",
    localizeInventoryFilterOption,
  );
  const activeFilterCount = countCompleteFilterRows(filterRows, filterFields);
  const hasActiveFilters = Boolean(query.trim()) || activeFilterCount > 0;

  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const dynamicOptions = useMemo(
    () => ({
      [INVENTORY_FILTER_OPTION_SOURCES.holders]: holders.map((holder) => ({ value: holder.id, label: holder.displayName })),
    }),
    [holders],
  );

  const directoryParams = useMemo(() => {
    const holderIds = debouncedQuery.trim()
      ? matchReferenceIds(holders, debouncedQuery, (holder) => holder.displayName, (holder) => holder.id)
      : [];
    return {
      ...DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS,
      page,
      limit: pageLimit,
      sort,
      search: createInventorySearchFilter(debouncedQuery),
      searchReferenceMatches: holderIds.length
        ? [
            { field: "toHolderId", ids: holderIds },
            { field: "fromHolderId", ids: holderIds },
          ]
        : undefined,
      ...(filterRows.length ? { filterRows } : {}),
    };
  }, [debouncedQuery, filterRows, holders, page, pageLimit, sort]);
  const directoryQuery = useInventoryDirectoryPage("dispatches", directoryParams);
  const pageRows = useResolvedPaginatedItems(directoryQuery.data?.items, directoryQuery.data?.total, directoryQuery.isFetching);
  const totalMatched = directoryQuery.data?.total ?? 0;
  rememberTotal(totalMatched);
  const totalPages = Math.max(1, Math.ceil(totalMatched / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const isLoading = directoryQuery.isLoading;
  const listErrorMessage = directoryQuery.isError
    ? toErrorMessage(directoryQuery.error)
    : isError
      ? toErrorMessage(error)
      : null;
  const commandPending = postDispatch.isPending || cancelDispatch.isPending;
  const editingDispatchValues = useMemo(() => (editingDispatch ? dispatchToFormValues(editingDispatch) : undefined), [editingDispatch]);

  function openAddForm() {
    if (!canCreate) return;
    setEditingDispatch(null);
    setFormMode("add");
  }

  function openEditForm(dispatch: InventoryDispatch) {
    if (!canUpdate || dispatch.status !== "DRAFT") return;
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
        const updated = await updateDispatch.mutateAsync({ dispatch: editingDispatch, values });
        notifyUpdated(t("inventory.references.dispatch"), getHolderNameById(updated.toHolderId, holders));
      } else {
        const created = await createDispatch.mutateAsync(values);
        notifyAdded(t("inventory.references.dispatch"), getHolderNameById(created.toHolderId, holders));
      }
      setFormMode(null);
      setEditingDispatch(null);
    } catch (mutationError) {
      notifyError(toErrorMessage(mutationError));
    }
  }

  async function confirmCommand() {
    if (!commandTarget) return;
    const { command, dispatch } = commandTarget;
    try {
      if (command === "post") {
        await postDispatch.mutateAsync(dispatch);
        notifySuccess(t("inventory.toasts.dispatchPosted"));
      } else {
        await cancelDispatch.mutateAsync(dispatch);
        notifySuccess(t("inventory.toasts.dispatchCancelled"));
      }
      setCommandTarget(null);
      setViewDispatch(null);
    } catch (mutationError) {
      notifyError(toErrorMessage(mutationError));
    }
  }

  const columns: DataTableColumn<InventoryDispatch>[] = [
    {
      id: "toHolder",
      label: t("inventory.form.fields.toHolder"),
      sortable: false,
      cellClassName: "font-medium",
      renderCell: (row) => getHolderNameById(row.toHolderId, holders) || dash,
    },
    { id: "fromHolder", label: t("inventory.form.fields.fromHolder"), sortable: false, renderCell: (row) => getHolderNameById(row.fromHolderId, holders) || dash },
    { id: "lines", label: t("inventory.columns.lines"), sortable: false, renderCell: (row) => summarizeDocumentLines(row.lines, items) || dash },
    { id: "totalQuantity", label: t("inventory.columns.totalQuantity"), sortable: false, cellClassName: "tabular-nums", renderCell: (row) => sumLineQuantities(row.lines) },
    {
      id: "assignee",
      label: t("inventory.form.fields.assigneeEmployee"),
      defaultVisible: false,
      sortable: false,
      renderCell: (row) => (row.assigneeEmployeeId ? employeeNames.get(row.assigneeEmployeeId) ?? row.assigneeEmployeeId : dash),
    },
    { id: "date", label: t("inventory.columns.date"), sortField: "dispatchedAt", renderCell: (row) => formatInventoryDateTime(row.dispatchedAt) },
    { id: "status", label: t("inventory.columns.status"), renderCell: (row) => <InventoryDocumentStatusBadge status={row.status} /> },
  ];

  const columnVisibility = useApiTableColumns("inventory-dispatches", columns, INVENTORY_DISPATCH_API_TABLE_FIELDS);
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query,
    matched: totalMatched,
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

      <InventoryDocumentMobileList
        title={t("inventory.submenus.dispatches")}
        description={t("inventory.pages.dispatches")}
        addLabel={t("inventory.actions.newDispatch")}
        searchPlaceholder={t("inventory.search.dispatches")}
        emptyMessage={t("inventory.empty.dispatches")}
        loadingTitle={t("inventory.loading.dispatches.title")}
        loadingDescription={t("inventory.loading.dispatches.description")}
        loadingColumns={[t("inventory.form.fields.toHolder"), t("inventory.columns.lines"), t("inventory.columns.status")]}
        icon={Truck}
        query={query}
        pageRows={pageRows}
        isLoading={isLoading}
        page={currentPage}
        totalPages={totalPages}
        onQueryChange={setQuery}
        onPageChange={setPage}
        onAdd={canCreate ? openAddForm : undefined}
        renderRow={(dispatch) => (
          <InventoryDocumentMobileRow
            key={dispatch.id}
            icon={Truck}
            iconClassName="bg-sky-100 text-sky-700"
            title={getHolderNameById(dispatch.toHolderId, holders) || dash}
            subtitle={formatInventoryDateTime(dispatch.dispatchedAt)}
            detail={summarizeDocumentLines(dispatch.lines, items) || dash}
            amount={String(sumLineQuantities(dispatch.lines))}
            amountLabel={t("inventory.columns.totalQuantity")}
            status={dispatch.status}
            onOpen={() => setViewDispatch(dispatch)}
            onEdit={canUpdate && dispatch.status === "DRAFT" ? () => openEditForm(dispatch) : undefined}
            onPost={canUpdate && dispatch.status === "DRAFT" ? () => setCommandTarget({ command: "post", dispatch }) : undefined}
          />
        )}
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
                presetScope="inventory-dispatches"
                dynamicOptions={dynamicOptions}
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
                placeholder={t("inventory.search.dispatches")}
              />
            }
          />
        </CardHeader>

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={Truck}
            title={t("inventory.loading.dispatches.title")}
            description={t("inventory.loading.dispatches.description")}
            columns={[t("inventory.form.fields.toHolder"), t("inventory.columns.lines"), t("inventory.columns.status")]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageRows}
            page={currentPage}
            rowKey={(row) => row.id}
            rowLabel={(row) => getHolderNameById(row.toHolderId, holders)}
            columnLayout={columnVisibility}
            sort={sort}
            onSortChange={onSortChange}
            minWidth={960}
            onRowClick={setViewDispatch}
            onRowDoubleClick={canUpdate ? openEditForm : undefined}
            activeRowId={viewDispatch?.id}
            emptyState={<p className="text-muted-foreground">{t("inventory.empty.dispatches")}</p>}
          />
        )}

        {!isLoading && !listErrorMessage ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", { count: pageRows.length, total: totalMatched, noun: t("inventory.submenus.dispatches").toLowerCase() })}
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
        holders={holders}
        employeeName={(employeeId) => employeeNames.get(employeeId) ?? employeeId}
        open={Boolean(viewDispatch)}
        isBusy={commandPending}
        onOpenChange={(open) => !open && setViewDispatch(null)}
        onEdit={canUpdate ? openEditForm : undefined}
        onPost={canUpdate ? (dispatch) => setCommandTarget({ command: "post", dispatch }) : undefined}
        onCancelDraft={canUpdate ? (dispatch) => setCommandTarget({ command: "cancel", dispatch }) : undefined}
      />

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="inset-x-0 bottom-0 top-auto flex h-[calc(100dvh-4rem)] max-h-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg">
          <DialogHeader className="shrink-0 border-b border-border bg-primary px-6 py-5 text-primary-foreground sm:bg-background sm:py-4 sm:text-foreground">
            <DialogTitle>{formMode === "edit" ? t("inventory.form.editDispatchTitle") : t("inventory.form.newDispatchTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryDispatchForm
            key={editingDispatch?.id ?? "new"}
            items={items}
            holders={holders}
            initialValues={editingDispatchValues}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("inventory.actions.saveDraft")}
            isSubmitting={createDispatch.isPending || updateDispatch.isPending}
            onCancel={() => setFormMode(null)}
            onSubmit={saveDispatch}
          />
        </DialogContent>
      </Dialog>

      <InventoryDocumentCommandDialog
        command={commandTarget?.command ?? null}
        copyKey="inventory.commands.dispatch"
        label={commandTarget ? getHolderNameById(commandTarget.dispatch.toHolderId, holders) : ""}
        isPending={commandPending}
        onConfirm={confirmCommand}
        onOpenChange={(open) => !open && setCommandTarget(null)}
      />
    </div>
  );
}
