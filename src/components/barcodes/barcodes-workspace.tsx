"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  PackageCheck,
  Plus,
  Printer,
  ScanBarcode,
  Trash2,
  Truck,
} from "lucide-react";

import { BarcodeForm } from "@/components/barcodes/barcode-form";
import { BarcodeViewSheet } from "@/components/barcodes/barcode-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { useBarcodeFilterFields } from "@/lib/barcodes/hooks/use-barcode-filter-fields";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTranslation } from "@/lib/i18n";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Badge } from "@/components/ui/badge";
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
import {
  computeBarcodeKpis,
  formatBarcodeContainer,
  formatBarcodeId,
  formatBarcodeScanDate,
  formatBarcodeStatus,
  getBarcodeStatusBadgeClass,
} from "@/lib/barcodes/display";
import {
  useBarcodeKpis,
  useBarcodeStats,
  useBarcodes,
  useCreateBarcode,
  useDeleteBarcodes,
  useUpdateBarcode,
} from "@/lib/barcodes/hooks/use-barcodes";
import {
  DEFAULT_BARCODE_LIST_PARAMS,
  barcodeToFormValues,
  buildBarcodeListParams,
  createEmptyBarcodeForm,
  type Barcode,
  type BarcodeFilterState,
  type BarcodeFormValues,
} from "@/lib/barcodes/types";
import type { DataTableColumn } from "@/lib/table/types";
import { useTableSort } from "@/lib/table/use-table-sort";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";

const PAGE_SIZE = DEFAULT_BARCODE_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: BarcodeFilterState = {
  query: "",
  rows: [],
};

export function BarcodesWorkspace() {
  const { t, locale } = useTranslation();
  const { toErrorMessage } = useUserError();
  const barcodeFilterFields = useBarcodeFilterFields();
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<BarcodeFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_BARCODE_LIST_PARAMS.sort, () => setPage(1));
  const [viewBarcode, setViewBarcode] = useState<Barcode | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingBarcode, setEditingBarcode] = useState<Barcode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Barcode | Barcode[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () =>
      buildBarcodeListParams({
        page,
        limit: PAGE_SIZE,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useBarcodes(listParams);
  const stats = useBarcodeStats();
  const kpiQuery = useBarcodeKpis();
  const createBarcodeMutation = useCreateBarcode();
  const updateBarcodeMutation = useUpdateBarcode();
  const deleteBarcodesMutation = useDeleteBarcodes();

  const barcodes = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const totalBarcodes = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalBarcodes / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    barcodes.length > 0 && barcodes.every((barcode) => selectedIds.includes(barcode.id));
  const isSaving =
    createBarcodeMutation.isPending ||
    updateBarcodeMutation.isPending ||
    deleteBarcodesMutation.isPending;

  useTableSelectionReset<number>(
    buildTableSelectionResetKey(debouncedQuery, filters.rows),
    setSelectedIds,
  );

  const kpis = useMemo(() => computeBarcodeKpis(kpiQuery.items), [kpiQuery.items]);

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...barcodes.map((barcode) => barcode.id)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !barcodes.some((barcode) => barcode.id === id)));
  }

  function toggleSelect(barcodeId: number, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, barcodeId] : current.filter((entry) => entry !== barcodeId),
    );
  }

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({ feature: "barcodes", baseHref: "/barcodes", mode: "add", label: t("barcodes.actions.add") });
      return;
    }
    setEditingBarcode(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(barcode: Barcode) {
    if (isDesktopTabs) {
      setViewBarcode(null);
      openFormTab({
        feature: "barcodes",
        baseHref: "/barcodes",
        mode: "edit",
        entityId: String(barcode.id),
        label: t("barcodes.actions.editNamed", { number: barcode.number }),
      });
      return;
    }
    setEditingBarcode(barcode);
    setFormMode("edit");
    setViewBarcode(null);
    setFormError(null);
  }

  async function saveBarcode(values: BarcodeFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingBarcode) {
        const nextBarcode = await updateBarcodeMutation.mutateAsync({
          barcodeId: editingBarcode.id,
          values,
        });
        notifyUpdated(t("barcodes.entity"), nextBarcode.number);
      } else {
        const nextBarcode = await createBarcodeMutation.mutateAsync(values);
        notifyAdded(t("barcodes.entity"), nextBarcode.number);
      }

      setFormMode(null);
      setEditingBarcode(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(toErrorMessage(mutationError));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((barcode) => barcode.id)
      : [deleteTarget.id];

    try {
      await deleteBarcodesMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewBarcode(null);
      notifyDeleted(t("barcodes.entity"), ids.length);
    } catch (mutationError) {
      setFormError(toErrorMessage(mutationError));
      setDeleteTarget(null);
    }
  }

  const statCards = [
    {
      label: t("barcodes.stats.total.label"),
      value: stats.isLoading ? "…" : stats.total.toString(),
      description: t("barcodes.stats.total.description"),
      icon: ScanBarcode,
    },
    {
      label: t("barcodes.stats.created.label"),
      value: kpiQuery.isLoading ? "…" : kpis.created.toString(),
      description: t("barcodes.stats.created.description"),
      icon: Plus,
    },
    {
      label: t("barcodes.stats.printed.label"),
      value: kpiQuery.isLoading ? "…" : kpis.printed.toString(),
      description: t("barcodes.stats.printed.description"),
      icon: Printer,
    },
    {
      label: t("barcodes.stats.inTransit.label"),
      value: kpiQuery.isLoading ? "…" : kpis.inTransit.toString(),
      description: t("barcodes.stats.inTransit.description"),
      icon: Truck,
    },
    {
      label: t("barcodes.stats.delivered.label"),
      value: kpiQuery.isLoading ? "…" : kpis.delivered.toString(),
      description: t("barcodes.stats.delivered.description"),
      icon: PackageCheck,
    },
  ];

  const tableColumns: DataTableColumn<Barcode>[] = [
    {
      id: "id",
      label: t("barcodes.columns.id"),
      cellClassName: "font-mono text-xs",
      renderCell: (barcode) => formatBarcodeId(barcode.id),
    },
    {
      id: "number",
      label: t("barcodes.columns.number"),
      sortField: "number",
      cellClassName: "font-mono text-xs font-medium",
      renderCell: (barcode) => barcode.number,
    },
    {
      id: "status",
      label: t("barcodes.columns.status"),
      renderCell: (barcode) => {
        const statusName = barcode.status?.name ?? "";
        if (!statusName) return t("common.empty.dash");
        return (
          <Badge variant="outline" className={getBarcodeStatusBadgeClass(statusName)}>
            {formatBarcodeStatus(barcode.status, t)}
          </Badge>
        );
      },
    },
    {
      id: "container",
      label: t("barcodes.columns.container"),
      renderCell: (barcode) => formatBarcodeContainer(barcode.container, t),
    },
    {
      id: "scanDate",
      label: t("barcodes.columns.scanDate"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (barcode) => formatBarcodeScanDate(barcode.scanDate, locale),
    },
  ];

  const columnVisibility = useColumnVisibility("barcodes-v1", tableColumns);
  const activeFilterCount = countCompleteFilterRows(filters.rows, barcodeFilterFields);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const noun = t("barcodes.noun");
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveFilters,
      query: filters.query,
      isSearchPending,
      matched: totalBarcodes,
      catalogTotal: stats.total,
      noun,
      isLoading: isFetching && barcodes.length === 0,
      catalogLoading: stats.isLoading,
    },
    t,
  );

  const deleteCount = Array.isArray(deleteTarget) ? deleteTarget.length : 1;
  const deleteDialogTitle =
    deleteCount > 1 ? t("barcodes.dialogs.deleteTitlePlural") : t("barcodes.dialogs.deleteTitle");

  return (
    <div>
      <PageHeader
        title={t("barcodes.title")}
        description={t("barcodes.pages.description")}
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            {t("barcodes.actions.add")}
          </Button>
        }
      />

      <StatCards items={statCards} />

      <Card className="mt-6 gap-0">
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
                placeholder={t("barcodes.search.placeholder")}
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={t("common.pagination.showingOf", {
                  count: barcodes.length,
                  total: totalBarcodes,
                  noun,
                })}
                presets={{
                  storageKey: "barcodes",
                  rows: filters.rows,
                  fields: barcodeFilterFields,
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
                  fields={barcodeFilterFields}
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
          selectedIds={selectedIds.map(String)}
          pageRowIds={barcodes.map((barcode) => String(barcode.id))}
          totalCount={totalBarcodes}
          onSelectedIdsChange={(ids) => setSelectedIds(ids.map(Number))}
          onEdit={() => {
            const barcode = barcodes.find((entry) => entry.id === selectedIds[0]);
            if (barcode) openEditForm(barcode);
          }}
          onDelete={() =>
            setDeleteTarget(barcodes.filter((barcode) => selectedIds.includes(barcode.id)))
          }
        />

        {isError ? (
          <div className="border-b px-6 py-3 text-sm text-destructive">
            {toErrorMessage(error)}
          </div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={ScanBarcode}
            title={t("barcodes.loading.title")}
            description={t("barcodes.loading.description")}
            columns={[
              t("barcodes.columns.number"),
              t("barcodes.columns.status"),
              t("barcodes.columns.container"),
              t("barcodes.columns.scanDate"),
            ]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={barcodes}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(barcode) => String(barcode.id)}
            rowLabel={(barcode) => barcode.number}
            columnLayout={columnVisibility}
            minWidth={960}
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds.map(String)}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={(id, checked) => toggleSelect(Number(id), checked)}
            onRowClick={setViewBarcode}
            onRowDoubleClick={openEditForm}
            activeRowId={viewBarcode ? String(viewBarcode.id) : undefined}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveFilters ? t("barcodes.empty.noMatch") : t("barcodes.empty.none")}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  {t("barcodes.actions.add")}
                </Button>
              </>
            }
          />
        )}

        {!isLoading && !isError ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("common.pagination.showingOf", {
                count: barcodes.length,
                total: totalBarcodes,
                noun,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isLoading}
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
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                {t("common.actions.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <BarcodeViewSheet
        barcode={viewBarcode}
        open={Boolean(viewBarcode)}
        onOpenChange={(open) => {
          if (!open) setViewBarcode(null);
        }}
        onEdit={openEditForm}
        onDelete={(barcode) => {
          setViewBarcode(null);
          setDeleteTarget(barcode);
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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {formMode === "edit" ? t("barcodes.form.editTitle") : t("barcodes.form.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <BarcodeForm
            key={editingBarcode?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingBarcode
                ? barcodeToFormValues(editingBarcode)
                : createEmptyBarcodeForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={
              formMode === "edit" ? t("common.actions.saveChanges") : t("barcodes.actions.add")
            }
            externalError={formError}
            isSubmitting={isSaving}
            onSubmit={saveBarcode}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteDialogTitle}</DialogTitle>
            <DialogDescription>
              {deleteCount > 1
                ? t("barcodes.dialogs.deleteMany", {
                    count: deleteCount,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("barcodes.dialogs.deleteOne", {
                    number: !Array.isArray(deleteTarget) ? deleteTarget?.number ?? "" : "",
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <Button variant="destructive" disabled={isSaving} onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" />
              {t("common.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
