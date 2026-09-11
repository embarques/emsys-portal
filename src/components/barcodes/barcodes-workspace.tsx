"use client";

import { useMemo, useState } from "react";
import {
  Container as ContainerIcon,
  PackageCheck,
  Printer,
  Route as RouteIcon,
  ScanBarcode,
  Tag,
  Truck,
} from "lucide-react";

import { BarcodeViewSheet } from "@/components/barcodes/barcode-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { AssignBarcodeRouteDialog } from "@/components/invoices/assign-barcode-route-dialog";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { TableTagText } from "@/components/app-shell/table-tag-text";
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
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useBarcodeFilterFields } from "@/lib/barcodes/hooks/use-barcode-filter-fields";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTranslation } from "@/lib/i18n";
import { useUserError } from "@/lib/errors";
import { normalizeApiError } from "@/lib/api/axios";
import {
  computeBarcodeKpis,
  formatBarcodeContainer,
  formatBarcodeDeliveryRoute,
  formatBarcodeStatus,
  getBarcodeStatusBadgeClass,
} from "@/lib/barcodes/display";
import { useBarcodeKpis, useBarcodeStats, useBarcodes } from "@/lib/barcodes/hooks/use-barcodes";
import {
  DEFAULT_BARCODE_LIST_PARAMS,
  buildBarcodeListParams,
  type Barcode,
  type BarcodeFilterState,
} from "@/lib/barcodes/types";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import type { BarcodeUpdate } from "@/lib/labels/api/barcodes-api";
import { useUpdateBarcodes } from "@/lib/labels/hooks/use-barcodes";
import { useBarcodeStatusOptions } from "@/lib/labels/hooks/use-label-display";
import { getBarcodeStatusLabel } from "@/lib/labels/display";
import { FALLBACK_BARCODE_STATUS_OPTIONS } from "@/lib/labels/types";
import type { DataTableColumn } from "@/lib/table/types";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";

const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: BarcodeFilterState = {
  query: "",
  rows: [],
};

export function BarcodesWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const barcodeFilterFields = useBarcodeFilterFields();
  const { notifyUpdated, notifyError } = useFeedback();
  const barcodeStatusOptions = useBarcodeStatusOptions();
  const { data: containersData } = useContainerPicker(200);
  const containers = containersData?.items ?? [];
  const updateBarcodesMutation = useUpdateBarcodes();

  const [filters, setFilters] = useState<BarcodeFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_BARCODE_LIST_PARAMS.sort, () => setPage(1));
  const [viewBarcode, setViewBarcode] = useState<Barcode | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [containerDialogOpen, setContainerDialogOpen] = useState(false);
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState(
    FALLBACK_BARCODE_STATUS_OPTIONS[0]?.name ?? "CREATED",
  );
  const [newContainerId, setNewContainerId] = useState("");
  const [bulkError, setBulkError] = useState<string | null>(null);

  const listParams = useMemo(
    () =>
      buildBarcodeListParams({
        page,
        limit: pageLimit,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useBarcodes(listParams);
  const stats = useBarcodeStats();
  const kpiQuery = useBarcodeKpis();

  const barcodes = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const totalBarcodes = data?.total ?? 0;
  rememberTotal(totalBarcodes);
  const totalPages = Math.max(1, Math.ceil(totalBarcodes / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    barcodes.length > 0 && barcodes.every((barcode) => selectedIds.includes(barcode.id));
  const selectedBarcodes = barcodes.filter((barcode) => selectedIds.includes(barcode.id));
  const isUpdating = updateBarcodesMutation.isPending;

  useTableSelectionReset<number>(
    buildTableSelectionResetKey(debouncedQuery, filters.rows),
    setSelectedIds,
  );

  const kpis = useMemo(() => computeBarcodeKpis(kpiQuery.items), [kpiQuery.items]);

  const statusOptions = useMemo(
    () =>
      (barcodeStatusOptions.length > 0 ? barcodeStatusOptions : FALLBACK_BARCODE_STATUS_OPTIONS).map(
        (entry) => ({
          value: entry.name,
          label: getBarcodeStatusLabel(entry.name, t),
        }),
      ),
    [barcodeStatusOptions, t],
  );

  const containerOptions = useMemo(
    () =>
      containers.map((container) => ({
        value: String(container.id),
        label: formatContainerLabel(container),
      })),
    [containers],
  );

  const assignRouteBarcodes = useMemo(
    () =>
      selectedBarcodes
        .filter((barcode) => barcode.number.trim().length > 0)
        .map((barcode) => ({
          number: barcode.number,
          barcodeId:
            barcode.barcodeId?.trim() ||
            (barcode.id > 0 ? String(barcode.id) : undefined),
          catalogId: barcode.id > 0 ? barcode.id : undefined,
          invoiceId: barcode.invoiceId,
          currentRouteName: barcode.route?.name,
        })),
    [selectedBarcodes],
  );

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...barcodes.map((barcode) => barcode.id)])),
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !barcodes.some((barcode) => barcode.id === id)),
    );
  }

  function toggleSelect(barcodeId: number, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, barcodeId] : current.filter((entry) => entry !== barcodeId),
    );
  }

  async function applyStatusChange() {
    const option = (barcodeStatusOptions.length > 0
      ? barcodeStatusOptions
      : FALLBACK_BARCODE_STATUS_OPTIONS
    ).find((entry) => entry.name === newStatus);
    if (!option || selectedBarcodes.length === 0) return;

    const updates: BarcodeUpdate[] = selectedBarcodes.map((barcode) => ({
      id: barcode.id,
      barcodeId: barcode.barcodeId,
      invoiceId: barcode.invoiceId,
      writeTarget: barcode.id > 0 ? "barcodes" : "invoice-embedded",
      payload: {
        number: barcode.number,
        status: { id: option.id, name: option.name },
        ...(barcode.container?.id != null
          ? { container: { id: barcode.container.id, name: barcode.container.name } }
          : {}),
      },
    }));

    setBulkError(null);
    try {
      await updateBarcodesMutation.mutateAsync(updates);
      notifyUpdated(t("barcodes.entity"), t("barcodes.bulk.updatedCount", { count: updates.length }));
      setStatusDialogOpen(false);
      setSelectedIds([]);
    } catch (mutationError) {
      setBulkError(normalizeApiError(mutationError).message);
      notifyError(toErrorMessage(mutationError));
    }
  }

  async function applyContainerChange() {
    const container = containers.find((entry) => String(entry.id) === newContainerId);
    if (!container || selectedBarcodes.length === 0) return;

    const updates: BarcodeUpdate[] = selectedBarcodes.map((barcode) => ({
      id: barcode.id,
      barcodeId: barcode.barcodeId,
      invoiceId: barcode.invoiceId,
      writeTarget: barcode.id > 0 ? "barcodes" : "invoice-embedded",
      payload: {
        number: barcode.number,
        status:
          barcode.status?.id != null && barcode.status.name?.trim()
            ? { id: barcode.status.id, name: barcode.status.name.trim() }
            : FALLBACK_BARCODE_STATUS_OPTIONS[0]
              ? {
                  id: FALLBACK_BARCODE_STATUS_OPTIONS[0].id,
                  name: FALLBACK_BARCODE_STATUS_OPTIONS[0].name,
                }
              : { id: 1, name: "CREATED" },
        container: { id: container.id, name: container.name },
      },
    }));

    setBulkError(null);
    try {
      await updateBarcodesMutation.mutateAsync(updates);
      notifyUpdated(t("barcodes.entity"), t("barcodes.bulk.updatedCount", { count: updates.length }));
      setContainerDialogOpen(false);
      setSelectedIds([]);
    } catch (mutationError) {
      setBulkError(normalizeApiError(mutationError).message);
      notifyError(toErrorMessage(mutationError));
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
      icon: Tag,
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
      id: "number",
      label: t("barcodes.columns.number"),
      sortField: "number",
      cellClassName: "font-mono text-xs font-medium",
      renderCell: (barcode) => barcode.number,
    },
    {
      id: "invoice",
      label: t("barcodes.columns.invoice"),
      renderCell: (barcode) => barcode.invoiceNumber?.trim() || t("common.empty.dash"),
    },
    {
      id: "description",
      label: t("barcodes.columns.description"),
      renderCell: (barcode) => barcode.description?.trim() || t("common.empty.dash"),
    },
    {
      id: "container",
      label: t("barcodes.columns.container"),
      renderCell: (barcode) => formatBarcodeContainer(barcode.container, t),
    },
    {
      id: "status",
      label: t("barcodes.columns.status"),
      renderCell: (barcode) => {
        const statusName = barcode.status?.name ?? "";
        if (!statusName) return t("common.empty.dash");
        return (
          <TableTagText className={getBarcodeStatusBadgeClass(statusName)}>
            {formatBarcodeStatus(barcode.status, t)}
          </TableTagText>
        );
      },
    },
    {
      id: "route.name",
      label: t("barcodes.columns.route"),
      sortField: "route.name",
      renderCell: (barcode) => formatBarcodeDeliveryRoute(barcode.route, t),
    },
  ];

  const columnVisibility = useColumnVisibility("barcodes-v2", tableColumns);
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

  return (
    <div>
      <PageHeader title={t("barcodes.title")} description={t("barcodes.pages.description")} />

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
          canEdit={false}
          canDelete={false}
          actions={
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={tableSelectionActionStyles.edit}
                disabled={selectedIds.length === 0 || isUpdating}
                onClick={() => {
                  setBulkError(null);
                  setNewStatus(
                    barcodeStatusOptions[0]?.name ??
                      FALLBACK_BARCODE_STATUS_OPTIONS[0]?.name ??
                      "CREATED",
                  );
                  setStatusDialogOpen(true);
                }}
              >
                <Tag className="h-4 w-4" />
                {t("barcodes.bulk.changeStatus")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={tableSelectionActionStyles.edit}
                disabled={selectedIds.length === 0 || isUpdating}
                onClick={() => {
                  setBulkError(null);
                  setNewContainerId(containers[0] ? String(containers[0].id) : "");
                  setContainerDialogOpen(true);
                }}
              >
                <ContainerIcon className="h-4 w-4" />
                {t("barcodes.bulk.changeContainer")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={tableSelectionActionStyles.edit}
                disabled={assignRouteBarcodes.length === 0 || isUpdating}
                onClick={() => setRouteDialogOpen(true)}
              >
                <RouteIcon className="h-4 w-4" />
                {t("barcodes.bulk.assignRoute")}
              </Button>
            </>
          }
        />

        {isError ? (
          <div className="border-b px-6 py-3 text-sm text-destructive">{toErrorMessage(error)}</div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={ScanBarcode}
            title={t("barcodes.loading.title")}
            description={t("barcodes.loading.description")}
            columns={[
              t("barcodes.columns.number"),
              t("barcodes.columns.invoice"),
              t("barcodes.columns.description"),
              t("barcodes.columns.container"),
              t("barcodes.columns.status"),
              t("barcodes.columns.route"),
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
            activeRowId={viewBarcode ? String(viewBarcode.id) : undefined}
            emptyState={
              <p className="text-muted-foreground">
                {hasActiveFilters ? t("barcodes.empty.noMatch") : t("barcodes.empty.none")}
              </p>
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

      <BarcodeViewSheet
        barcode={viewBarcode}
        open={Boolean(viewBarcode)}
        onOpenChange={(open) => {
          if (!open) setViewBarcode(null);
        }}
      />

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("barcodes.bulk.statusTitle")}</DialogTitle>
            <DialogDescription>
              {t("barcodes.bulk.statusDescription", { count: selectedIds.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("barcodes.form.fields.status")}</Label>
            <SearchableSelect
              value={newStatus}
              onValueChange={setNewStatus}
              options={statusOptions}
              placeholder={t("barcodes.form.placeholders.status")}
              searchPlaceholder={t("barcodes.form.search.statuses")}
            />
            {bulkError ? <p className="text-sm text-destructive">{bulkError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={isUpdating}>
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={() => void applyStatusChange()} disabled={isUpdating || !newStatus}>
              {t("barcodes.bulk.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={containerDialogOpen} onOpenChange={setContainerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("barcodes.bulk.containerTitle")}</DialogTitle>
            <DialogDescription>
              {t("barcodes.bulk.containerDescription", { count: selectedIds.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t("barcodes.form.fields.container")}</Label>
            <SearchableSelect
              value={newContainerId}
              onValueChange={setNewContainerId}
              options={containerOptions}
              placeholder={t("barcodes.form.placeholders.container")}
              searchPlaceholder={t("barcodes.form.search.containers")}
            />
            {bulkError ? <p className="text-sm text-destructive">{bulkError}</p> : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setContainerDialogOpen(false)}
              disabled={isUpdating}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              onClick={() => void applyContainerChange()}
              disabled={isUpdating || !newContainerId}
            >
              {t("barcodes.bulk.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssignBarcodeRouteDialog
        open={routeDialogOpen}
        onOpenChange={setRouteDialogOpen}
        barcodes={assignRouteBarcodes}
        onResult={(result) => {
          if (result.success) {
            setSelectedIds([]);
          }
        }}
      />
    </div>
  );
}
