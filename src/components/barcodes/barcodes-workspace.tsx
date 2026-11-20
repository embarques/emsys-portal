"use client";

import { useMemo, useState } from "react";
import { isDeliveredBarcode } from "@/lib/labels/route-assignment-policy";
import { usePrintBarcodes } from "@/lib/barcodes/hooks/use-print-barcodes";
import { barcodeSelectionKey } from "@/lib/barcodes/print-barcodes";
import { useInitialBarcodeFilters } from "@/lib/barcodes/hooks/use-initial-barcode-filters";
import {
  Container as ContainerIcon,
  FileText,
  PackageCheck,
  Printer,
  Route as RouteIcon,
  ScanBarcode,
  Tag,
  Truck,
} from "lucide-react";

import { BarcodeViewSheet } from "@/components/barcodes/barcode-view-sheet";
import { BarcodeStatusesButton } from "@/components/barcodes/barcode-statuses-button";
import { DeliverDialog } from "@/components/deliveries/deliver-dialog";
import { useDeliveryAccess } from "@/lib/deliveries/hooks/use-deliver-invoice";
import { canStartBarcodeDelivery } from "@/lib/deliveries/utils/can-start-barcode-delivery";
import { InvoiceEditWizard } from "@/components/invoices/invoice-form-workspace";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";
import {
  DirectoryInsightsFlip,
  DirectoryInsightsToggle,
} from "@/components/app-shell/directory-insights-flip";
import { TableSelectionActionsMenu } from "@/components/app-shell/table-selection-actions-menu";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { AssignBarcodeRouteDialog } from "@/components/invoices/assign-barcode-route-dialog";
import { useApiTableColumns } from "@/components/app-shell/use-api-table-columns";
import { BARCODE_API_TABLE_FIELDS } from "@/lib/barcodes/table-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Card, CardHeader } from "@/components/ui/card";
import {
  CompactActionDialogContent,
  CompactActionDialogFooter,
} from "@/components/forms/compact-action-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  formatBarcodeDelivery,
  formatBarcodeDeliveryRoute,
  formatBarcodeTripNumber,
  formatBarcodeStatus,
  getBarcodeStatusBadgeClass,
} from "@/lib/barcodes/display";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useBarcodeKpis, useBarcodeStats, useBarcodes } from "@/lib/barcodes/hooks/use-barcodes";
import {
  DEFAULT_BARCODE_DIRECTORY_SORT,
  buildBarcodeListParams,
  type Barcode,
  type BarcodeFilterState,
} from "@/lib/barcodes/types";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { formatInvoiceTabLabel } from "@/lib/invoices/display";
import type { BarcodeUpdate } from "@/lib/labels/api/barcodes-api";
import { useUpdateBarcodes } from "@/lib/labels/hooks/use-barcodes";
import { useBarcodeStatusOptions } from "@/lib/labels/hooks/use-label-display";
import { getBarcodeStatusLabel } from "@/lib/labels/display";
import { FALLBACK_BARCODE_STATUS_OPTIONS } from "@/lib/labels/types";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { DataTableColumn } from "@/lib/table/types";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { formatPaginatedListSummary } from "@/lib/table/list-summary";
import { useTableSort } from "@/lib/table/use-table-sort";
import { tableSelectionActionMenuStyles, tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

const invoiceWizardDialogClassName =
  "left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-[100dvw] max-w-[100dvw] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden overflow-x-hidden rounded-none border-0 p-0 max-sm:[&>button:last-child]:hidden sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border";

const defaultFilters: BarcodeFilterState = {
  query: "",
  rows: [],
};

function getInvoiceTargetForBarcode(barcode: Barcode) {
  const invoiceId = barcode.invoiceId?.trim();
  if (!invoiceId) return null;
  const focusBarcodeId =
    barcode.barcodeId?.trim() ||
    barcode.number.trim() ||
    (barcode.id > 0 ? String(barcode.id) : "");
  return {
    invoiceId,
    invoiceNumber: barcode.invoiceNumber?.trim() || "",
    focusBarcodeId: focusBarcodeId || undefined,
  };
}

function toAssignRouteBarcode(barcode: Barcode) {
  return {
    number: barcode.number,
    barcodeId:
      barcode.barcodeId?.trim() ||
      (barcode.id > 0 ? String(barcode.id) : undefined),
    catalogId: barcode.id > 0 ? barcode.id : undefined,
    invoiceId: barcode.invoiceId,
    currentRouteName: barcode.route?.name,
  };
}

export function BarcodesWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const barcodeFilterFields = useBarcodeFilterFields();
  const { notifyUpdated, notifyError } = useFeedback();
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const { hasPermission } = useAuth();
  // Barcodes are owned by invoice line items; editing them opens the invoice editor.
  const canUpdateInvoices = hasPermission(PERMISSIONS.invoicesUpdate.name, PERMISSIONS.invoicesUpdate.resourceType);
  const barcodeStatusOptions = useBarcodeStatusOptions();
  const { data: containersData } = useContainerPicker(200);
  const containers = useMemo(() => containersData?.items ?? [], [containersData?.items]);
  const updateBarcodesMutation = useUpdateBarcodes();
  const { canPrint, isPrinting, printBarcodes } = usePrintBarcodes();
  const deliveryAccess = useDeliveryAccess();
  const deliveryScope = `${deliveryAccess.companyId}:${deliveryAccess.actorId}:${deliveryAccess.viewScope}`;
  const [deliveryTarget, setDeliveryTarget] = useState<{ scope: string; barcode: Barcode } | null>(null);
  const deliverBarcode = deliveryTarget?.scope === deliveryScope ? deliveryTarget.barcode : null;

  const initialFilters = useInitialBarcodeFilters();
  const [filters, setFilters] = useState<BarcodeFilterState>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(initialFilters.rows.length > 0);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_BARCODE_DIRECTORY_SORT, () => setPage(1));
  const [viewBarcode, setViewBarcode] = useState<Barcode | null>(null);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [editInvoiceInitialStep, setEditInvoiceInitialStep] = useState<number | undefined>(undefined);
  const [editInvoiceFocusBarcodeId, setEditInvoiceFocusBarcodeId] = useState<string | undefined>(
    undefined,
  );
  const [editInvoiceFormNonce, setEditInvoiceFormNonce] = useState(0);

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
    barcodes.length > 0 && barcodes.every((barcode) => selectedIds.includes(barcodeSelectionKey(barcode)));
  const selectedBarcodes = barcodes.filter((barcode) => selectedIds.includes(barcodeSelectionKey(barcode)));
  const isUpdating = updateBarcodesMutation.isPending;

  useTableSelectionReset<string>(
    buildTableSelectionResetKey(debouncedQuery, filters.rows, page, pageLimit),
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
        .filter((barcode) => barcode.number.trim().length > 0 && !isDeliveredBarcode(barcode.status))
        .map(toAssignRouteBarcode),
    [selectedBarcodes],
  );

  const selectedInvoiceTarget = useMemo(() => {
    if (selectedBarcodes.length !== 1) return null;
    return getInvoiceTargetForBarcode(selectedBarcodes[0]);
  }, [selectedBarcodes]);

  function openInvoiceForBarcode(
    barcode: Barcode,
    options?: {
      initialWizardStep?: number;
      focusBarcode?: boolean;
    },
  ) {
    const target = getInvoiceTargetForBarcode(barcode);
    if (!target) {
      notifyError(t("barcodes.bulk.noInvoice"));
      return;
    }

    setViewBarcode(null);

    const focusBarcodeId = options?.focusBarcode ? target.focusBarcodeId : undefined;
    const initialWizardStep = options?.initialWizardStep;
    const formNonce = Date.now();

    const label = formatInvoiceTabLabel(
      { invoiceNumber: target.invoiceNumber },
      t("invoices.workspace.untitledTab"),
    );

    if (isDesktopTabs) {
      openFormTab({
        feature: "invoices",
        baseHref: "/invoices",
        mode: "edit",
        entityId: target.invoiceId,
        label,
        ...(initialWizardStep != null ? { initialWizardStep } : {}),
        ...(focusBarcodeId ? { focusBarcodeId } : {}),
      });
      return;
    }

    setEditInvoiceInitialStep(initialWizardStep);
    setEditInvoiceFocusBarcodeId(focusBarcodeId);
    setEditInvoiceFormNonce(formNonce);
    setEditInvoiceId(target.invoiceId);
  }

  function openSelectedInvoice(options?: {
    initialWizardStep?: number;
    focusBarcode?: boolean;
  }) {
    if (!selectedBarcodes[0]) {
      notifyError(t("barcodes.bulk.noInvoice"));
      return;
    }
    openInvoiceForBarcode(selectedBarcodes[0], options);
  }

  function selectBarcodeForBulk(barcode: Barcode) {
    setSelectedIds([barcodeSelectionKey(barcode)]);
  }

  function openStatusForBarcode(barcode: Barcode) {
    selectBarcodeForBulk(barcode);
    setBulkError(null);
    setNewStatus(
      barcodeStatusOptions[0]?.name ??
        FALLBACK_BARCODE_STATUS_OPTIONS[0]?.name ??
        "CREATED",
    );
    setStatusDialogOpen(true);
  }

  function openContainerForBarcode(barcode: Barcode) {
    selectBarcodeForBulk(barcode);
    setBulkError(null);
    setNewContainerId(containers[0] ? String(containers[0].id) : "");
    setContainerDialogOpen(true);
  }

  function openRouteForBarcode(barcode: Barcode) {
    selectBarcodeForBulk(barcode);
    setRouteDialogOpen(true);
  }

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...barcodes.map(barcodeSelectionKey)])),
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !barcodes.some((barcode) => barcodeSelectionKey(barcode) === id)),
    );
  }

  function toggleSelect(barcodeId: string, checked: boolean) {
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
      const updated = await updateBarcodesMutation.mutateAsync(updates);
      const succeeded = updated.length;
      const failed = updates.length - succeeded;
      notifyUpdated(t("barcodes.entity"), t("barcodes.bulk.updatedCount", { count: succeeded }));
      if (failed > 0) {
        notifyError(
          t("common.toasts.bulkPartialFailure", {
            failed,
            total: updates.length,
            message: t("common.errors.fallback"),
          }),
        );
      }
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
      const updated = await updateBarcodesMutation.mutateAsync(updates);
      const succeeded = updated.length;
      const failed = updates.length - succeeded;
      notifyUpdated(t("barcodes.entity"), t("barcodes.bulk.updatedCount", { count: succeeded }));
      if (failed > 0) {
        notifyError(
          t("common.toasts.bulkPartialFailure", {
            failed,
            total: updates.length,
            message: t("common.errors.fallback"),
          }),
        );
      }
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

  const insightMetrics = statCards;

  const tableColumns: DataTableColumn<Barcode>[] = [
    {
      id: "id",
      label: t("barcodes.columns.id"),
      sortField: "id",
      defaultVisible: false,
      cellClassName: "font-mono text-xs text-muted-foreground",
      renderCell: (barcode) => (barcode.id > 0 ? String(barcode.id) : t("common.empty.dash")),
    },
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
      sortField: "invoice.number",
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
          <Badge
            variant="outline"
            className={cn("whitespace-nowrap rounded-full px-2.5 py-1", getBarcodeStatusBadgeClass(statusName))}
          >
            {formatBarcodeStatus(barcode.status, t)}
          </Badge>
        );
      },
    },
    {
      id: "route.name",
      label: t("barcodes.columns.route"),
      sortField: "route.name",
      renderCell: (barcode) => formatBarcodeDeliveryRoute(barcode.route, t),
    },
    {
      id: "delivery",
      label: t("barcodes.columns.delivery"),
      defaultVisible: false,
      renderCell: (barcode) => formatBarcodeDelivery(barcode.delivery, t),
    },
    {
      id: "tripNumber",
      label: t("barcodes.columns.tripNumber"),
      defaultVisible: false,
      renderCell: (barcode) => formatBarcodeTripNumber(barcode.tripNumber, t),
    },
    {
      id: "scanDate",
      label: t("barcodes.columns.scanDate"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (barcode) => formatAuditDateTime(barcode.scanDate ?? ""),
    },
    {
      id: "createdAt",
      label: t("barcodes.columns.createdAt"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (barcode) => formatAuditDateTime(barcode.createdAt ?? ""),
    },
    {
      id: "createdBy",
      label: t("barcodes.columns.createdBy"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (barcode) => barcode.createdBy?.trim() || t("common.empty.dash"),
    },
    {
      id: "updatedAt",
      label: t("barcodes.columns.updatedAt"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (barcode) => formatAuditDateTime(barcode.updatedAt ?? ""),
    },
    {
      id: "updatedBy",
      label: t("barcodes.columns.updatedBy"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (barcode) => barcode.updatedBy?.trim() || t("common.empty.dash"),
    },
  ];

  const columnVisibility = useApiTableColumns("barcodes-v3", tableColumns, BARCODE_API_TABLE_FIELDS, [
    {
      id: "barcodeId",
      label: t("barcodes.columns.barcodeId"),
      defaultVisible: false,
      cellClassName: "font-mono text-xs text-muted-foreground",
      renderCell: (barcode) => barcode.barcodeId?.trim() || t("common.empty.dash"),
    },
  ]);
  const activeFilterCount = countCompleteFilterRows(filters.rows, barcodeFilterFields);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: barcodes.length,
      page: currentPage,
      pageSize: pageLimit,
      total: totalBarcodes,
      noun: t("barcodes.noun"),
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
        title={t("barcodes.title")}
        description={t("barcodes.pages.description")}
        actions={<BarcodeStatusesButton />}
      />

      <StatCards items={statCards} />

      <DirectoryInsightsFlip
        open={insightsOpen}
        onOpenChange={setInsightsOpen}
        metrics={insightMetrics}
        title={t("barcodes.title")}
        className="mt-6"
      >
      <Card className="gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            columnLayout={columnVisibility}
            actions={
              <DirectoryInsightsToggle open={insightsOpen} onOpenChange={setInsightsOpen} />
            }
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
              <TableFilterPanel isLoading={isFetching || isSearchPending}
                resultSummary={listSummary}
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
          selectedIds={selectedIds}
          pageRowIds={barcodes.map(barcodeSelectionKey)}
          totalCount={totalBarcodes}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => openSelectedInvoice({ initialWizardStep: 3, focusBarcode: true })}
          onDelete={() => openSelectedInvoice({ initialWizardStep: 3, focusBarcode: true })}
          canEdit={canUpdateInvoices}
          canDelete={canUpdateInvoices}
          editDisabled={!selectedInvoiceTarget || isUpdating}
          deleteDisabled={!selectedInvoiceTarget || isUpdating}
          actions={
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn("whitespace-nowrap", tableSelectionActionStyles.print)}
                disabled={!canPrint || isPrinting || isUpdating || isFetching || selectedBarcodes.length !== selectedIds.length}
                onClick={() => void printBarcodes(selectedBarcodes)}
              >
                <Printer className="h-4 w-4" />
                {t(isPrinting ? "barcodes.print.preparing" : "barcodes.print.action")}
              </Button>
              <TableSelectionActionsMenu
                disabled={isUpdating || isFetching}
                hidden={
                  !deliveryAccess.canDeliver &&
                  !canUpdateInvoices &&
                  selectedIds.length === 0
                }
              >
                {deliveryAccess.canDeliver ? (
                  <DropdownMenuItem
                    disabled={
                      selectedBarcodes.length !== 1 ||
                      !canStartBarcodeDelivery(selectedBarcodes[0]) ||
                      isUpdating ||
                      isFetching
                    }
                    onSelect={() => {
                      const barcode = selectedBarcodes[0];
                      if (canStartBarcodeDelivery(barcode)) {
                        setDeliveryTarget({ scope: deliveryScope, barcode });
                      }
                    }}
                    className={tableSelectionActionMenuStyles.deliver}
                  >
                    <PackageCheck className="size-4" />
                    {t("deliveries.deliver.action")}
                  </DropdownMenuItem>
                ) : null}
                {canUpdateInvoices ? (
                  <DropdownMenuItem
                    disabled={!selectedInvoiceTarget || isUpdating}
                    onSelect={() => openSelectedInvoice()}
                    className={tableSelectionActionMenuStyles.view}
                  >
                    <FileText className="size-4" />
                    {t("barcodes.bulk.openInvoice")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  disabled={selectedIds.length === 0 || isUpdating}
                  onSelect={() => {
                    setBulkError(null);
                    setNewStatus(
                      barcodeStatusOptions[0]?.name ??
                        FALLBACK_BARCODE_STATUS_OPTIONS[0]?.name ??
                        "CREATED",
                    );
                    setStatusDialogOpen(true);
                  }}
                  className={tableSelectionActionMenuStyles.status}
                >
                  <Tag className="size-4" />
                  {t("barcodes.bulk.changeStatus")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={selectedIds.length === 0 || isUpdating}
                  onSelect={() => {
                    setBulkError(null);
                    setNewContainerId(containers[0] ? String(containers[0].id) : "");
                    setContainerDialogOpen(true);
                  }}
                  className={tableSelectionActionMenuStyles.transfer}
                >
                  <ContainerIcon className="size-4" />
                  {t("barcodes.bulk.changeContainer")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={assignRouteBarcodes.length === 0 || isUpdating}
                  onSelect={() => setRouteDialogOpen(true)}
                  className={tableSelectionActionMenuStyles.assign}
                >
                  <RouteIcon className="size-4" />
                  {t("barcodes.bulk.assignRoute")}
                </DropdownMenuItem>
              </TableSelectionActionsMenu>
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
            isPageDataPending={isFetching || isSearchPending}
            rowKey={barcodeSelectionKey}
            rowLabel={(barcode) => barcode.number}
            columnLayout={columnVisibility}
            minWidth={960}
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewBarcode}
            activeRowId={viewBarcode ? barcodeSelectionKey(viewBarcode) : undefined}
            emptyState={
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters ? t("barcodes.empty.noMatch") : t("barcodes.empty.none")}
              </p>
            }
          />
        )}

        {!isLoading && !isError ? (
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
      </DirectoryInsightsFlip>

      <BarcodeViewSheet
        barcode={viewBarcode}
        open={Boolean(viewBarcode)}
        onOpenChange={(open) => {
          if (!open) setViewBarcode(null);
        }}
        actionsDisabled={isUpdating || isFetching}
        canDeliver={deliveryAccess.canDeliver}
        canPrint={canPrint}
        canOpenInvoice={canUpdateInvoices}
        canChangeStatus
        canTransferContainer
        canAssignRoute
        canEdit={canUpdateInvoices}
        canDelete={canUpdateInvoices}
        deliverDisabled={!viewBarcode || !canStartBarcodeDelivery(viewBarcode)}
        printDisabled={!viewBarcode || !canPrint}
        isPrinting={isPrinting}
        openInvoiceDisabled={!viewBarcode || !getInvoiceTargetForBarcode(viewBarcode)}
        assignRouteDisabled={
          !viewBarcode ||
          viewBarcode.number.trim().length === 0 ||
          isDeliveredBarcode(viewBarcode.status)
        }
        editDisabled={!viewBarcode || !getInvoiceTargetForBarcode(viewBarcode)}
        deleteDisabled={!viewBarcode || !getInvoiceTargetForBarcode(viewBarcode)}
        onDeliver={(barcode) => {
          if (canStartBarcodeDelivery(barcode)) {
            setDeliveryTarget({ scope: deliveryScope, barcode });
          }
        }}
        onPrint={(barcode) => {
          void printBarcodes([barcode]);
        }}
        onOpenInvoice={(barcode) => openInvoiceForBarcode(barcode)}
        onChangeStatus={openStatusForBarcode}
        onTransferContainer={openContainerForBarcode}
        onAssignRoute={openRouteForBarcode}
        onEdit={(barcode) =>
          openInvoiceForBarcode(barcode, { initialWizardStep: 3, focusBarcode: true })
        }
        onDelete={(barcode) =>
          openInvoiceForBarcode(barcode, { initialWizardStep: 3, focusBarcode: true })
        }
      />

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <CompactActionDialogContent>
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
          </div>
          <CompactActionDialogFooter
            error={bulkError}
            onCancel={() => setStatusDialogOpen(false)}
            cancelDisabled={isUpdating}
            onSubmit={() => void applyStatusChange()}
            submitLabel={t("barcodes.bulk.apply")}
            submitDisabled={!newStatus}
            isSubmitting={isUpdating}
          />
        </CompactActionDialogContent>
      </Dialog>

      <Dialog open={containerDialogOpen} onOpenChange={setContainerDialogOpen}>
        <CompactActionDialogContent>
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
          </div>
          <CompactActionDialogFooter
            error={bulkError}
            onCancel={() => setContainerDialogOpen(false)}
            cancelDisabled={isUpdating}
            onSubmit={() => void applyContainerChange()}
            submitLabel={t("barcodes.bulk.apply")}
            submitDisabled={!newContainerId}
            isSubmitting={isUpdating}
          />
        </CompactActionDialogContent>
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

      <Dialog
        open={editInvoiceId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditInvoiceId(null);
            setEditInvoiceInitialStep(undefined);
            setEditInvoiceFocusBarcodeId(undefined);
          }
        }}
      >
        <DialogContent className={invoiceWizardDialogClassName}>
          <DialogHeader className="hidden shrink-0 border-b border-border px-5 py-4 sm:block sm:px-6">
            <DialogTitle>
              {selectedInvoiceTarget?.invoiceNumber
                ? t("invoices.workspace.editInvoiceNamed", {
                    number: formatInvoiceTabLabel(
                      { invoiceNumber: selectedInvoiceTarget.invoiceNumber },
                      t("invoices.workspace.untitledTab"),
                    ),
                  })
                : t("invoices.workspace.editInvoice")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {editInvoiceId ? (
              <InvoiceEditWizard
                inDialog
                invoiceId={editInvoiceId}
                onCancel={() => {
                  setEditInvoiceId(null);
                  setEditInvoiceInitialStep(undefined);
                  setEditInvoiceFocusBarcodeId(undefined);
                }}
                initialWizardStep={editInvoiceInitialStep}
                focusBarcodeId={editInvoiceFocusBarcodeId}
                formNonce={editInvoiceFormNonce}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      {deliverBarcode && deliveryAccess.canDeliver ? (
        <DeliverDialog
          key={`${deliveryAccess.companyId}:${deliveryAccess.actorId}:${deliverBarcode.invoiceId}:${deliverBarcode.delivery?.id}`}
          target={deliverBarcode}
          onClose={() => setDeliveryTarget(null)}
          onDelivered={() => {
            setDeliveryTarget(null);
            setSelectedIds([]);
          }}
        />
      ) : null}
    </div>
  );
}
