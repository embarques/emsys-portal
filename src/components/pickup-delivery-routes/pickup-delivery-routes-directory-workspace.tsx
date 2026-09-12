"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CalendarRange, Plus } from "lucide-react";

import { ActiveRouteSection } from "@/components/pickup-delivery-routes/pickup-delivery-route-section";
import { ActiveRouteViewSheet } from "@/components/pickup-delivery-routes/pickup-delivery-route-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
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
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { useUserError } from "@/lib/errors/use-user-error";
import {
  formatActiveRouteAppraiserName,
  formatActiveRouteContainerLabel,
  formatActiveRouteDriverNames,
  formatActiveRouteHelperNames,
  formatActiveRouteRowLabel,
  formatActiveRouteRouteName,
  formatActiveRouteTypeLabel,
  formatActiveRouteVehicleLabel,
} from "@/lib/pickup-delivery-routes/display";
import {
  buildActiveRouteListParams,
  type ActiveRoute,
  type ActiveRouteFilterState,
} from "@/lib/pickup-delivery-routes/types";
import { useActiveRouteFilterFields } from "@/lib/pickup-delivery-routes/hooks/use-active-route-filter-fields";
import { useActiveRoutes, useDeleteActiveRoutes } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useDirectoryBranchFilter } from "@/lib/branches/hooks/use-directory-branch-filter";
import { useRouteLookup } from "@/lib/route-manager/hooks/use-route-manager";
import { formatAuditDateTime } from "@/lib/audit/display";
import { formatRouteDate } from "@/lib/route-manager/display";
import type { ActiveRoutesDirectoryVariant } from "@/lib/pickup-delivery-routes/directory-variant";
import type { DataTableColumn } from "@/lib/table/types";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { formatPaginatedListSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTranslation } from "@/lib/i18n";
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";

const SEARCH_DEBOUNCE_MS = 300;

const defaultActiveRouteFilters: ActiveRouteFilterState = {
  query: "",
  rows: [],
};

type ActiveRoutesDirectoryWorkspaceProps = {
  variant: ActiveRoutesDirectoryVariant;
  /** Delivery routes only — shows GET `id` in the table. */
  showRecordIdColumn?: boolean;
  /** Delivery routes only — e.g. print report action. */
  renderSelectionActions?: (context: {
    activeRoutes: ActiveRoute[];
    selectedIds: string[];
  }) => ReactNode;
};

export function ActiveRoutesDirectoryWorkspace({
  variant,
  showRecordIdColumn = false,
  renderSelectionActions,
}: ActiveRoutesDirectoryWorkspaceProps) {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const copyPrefix = variant.copyPrefix;
  const activeRouteFilterFields = useActiveRouteFilterFields(variant.routeType);
  const { notifyDeleted, notifyError } = useFeedback();
  const [activeRouteFilters, setActiveRouteFilters] =
    useState<ActiveRouteFilterState>(defaultActiveRouteFilters);
  const {
    branchCode,
    selectValue,
    setBranchCode,
    isReady: isBranchFilterReady,
    branchOptions,
    branchesLoading,
  } = useDirectoryBranchFilter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedActiveRouteQuery = useDebouncedValue(activeRouteFilters.query, SEARCH_DEBOUNCE_MS);
  const [selectedActiveRouteIds, setSelectedActiveRouteIds] = useState<string[]>([]);
  const {
    page: activeRoutePage,
    setPage: setActiveRoutePage,
    pageSize,
    pageLimit,
    changePageSize,
    rememberTotal,
  } = useTablePageSize();
  const [activeRouteDialogOpen, setActiveRouteDialogOpen] = useState(false);
  const [editingActiveRoute, setEditingActiveRoute] = useState<ActiveRoute | null>(null);
  const [deleteActiveRouteTarget, setDeleteActiveRouteTarget] = useState<
    ActiveRoute | ActiveRoute[] | null
  >(null);
  const [viewActiveRoute, setViewActiveRoute] = useState<ActiveRoute | null>(null);

  const activeRouteListParams = useMemo(
    () =>
      buildActiveRouteListParams({
        page: activeRoutePage,
        limit: pageLimit,
        query: debouncedActiveRouteQuery,
        rows: activeRouteFilters.rows,
        routeType: variant.routeType,
        branchCode,
      }),
    [
      activeRoutePage,
      activeRouteFilters.rows,
      branchCode,
      debouncedActiveRouteQuery,
      pageLimit,
      variant.routeType,
    ],
  );

  const activeRoutesQuery = useActiveRoutes(activeRouteListParams, {
    enabled: isBranchFilterReady,
  });
  const deleteActiveRoutesMutation = useDeleteActiveRoutes(variant.routeType);
  const routeLookup = useRouteLookup(200, {
    enabled: true,
  });

  const activeRoutes = useResolvedPaginatedItems(
    activeRoutesQuery.data?.items,
    activeRoutesQuery.data?.total,
    activeRoutesQuery.isFetching || !isBranchFilterReady,
  );
  const totalActiveRoutes = activeRoutesQuery.data?.total ?? 0;
  rememberTotal(totalActiveRoutes);
  const totalActiveRoutePages = Math.max(1, Math.ceil(totalActiveRoutes / pageLimit));
  const currentActiveRoutePage = Math.min(activeRoutePage, totalActiveRoutePages);

  const allActiveRoutePageSelected =
    activeRoutes.length > 0 &&
    activeRoutes.every((record) => selectedActiveRouteIds.includes(record.id));
  const isSaving = deleteActiveRoutesMutation.isPending;

  useTableSelectionReset(
    buildTableSelectionResetKey(
      debouncedActiveRouteQuery,
      variant.routeType ?? "daily",
      branchCode,
      activeRouteFilters.rows,
    ),
    setSelectedActiveRouteIds,
  );

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function toggleActiveRouteSelect(recordId: string, checked: boolean) {
    setSelectedActiveRouteIds((current) =>
      checked ? [...current, recordId] : current.filter((entry) => entry !== recordId),
    );
  }

  function toggleActiveRouteSelectAll(checked: boolean) {
    if (checked) {
      setSelectedActiveRouteIds((current) =>
        Array.from(new Set([...current, ...activeRoutes.map((record) => record.id)])),
      );
      return;
    }
    setSelectedActiveRouteIds((current) =>
      current.filter((id) => !activeRoutes.some((record) => record.id === id)),
    );
  }

  function openActiveRouteDialog(record: ActiveRoute | null = null) {
    setEditingActiveRoute(record);
    setActiveRouteDialogOpen(true);
  }

  function openAddActiveRoute() {
    if (isDesktopTabs) {
      openFormTab({
        feature: variant.formFeature,
        baseHref: variant.baseHref,
        mode: "add",
        label: t(`routes.${copyPrefix}.addTabLabel`),
      });
      return;
    }
    openActiveRouteDialog(null);
  }

  function openEditActiveRoute(record: ActiveRoute) {
    if (isDesktopTabs) {
      openFormTab({
        feature: variant.formFeature,
        baseHref: variant.baseHref,
        mode: "edit",
        entityId: record.id,
        label: t(`routes.${copyPrefix}.editTabLabel`, {
          name: formatActiveRouteRowLabel(record, dash, t),
        }),
      });
      return;
    }
    openActiveRouteDialog(record);
  }

  async function confirmDeleteActiveRoutes() {
    if (!deleteActiveRouteTarget) return;

    const ids = Array.isArray(deleteActiveRouteTarget)
      ? deleteActiveRouteTarget.map((record) => record.id)
      : [deleteActiveRouteTarget.id];

    try {
      const result = await deleteActiveRoutesMutation.mutateAsync(ids);

      reportBulkSettled({
        result,
        t,
        entityLabel: t(`routes.${copyPrefix}.entities.activeRoute`),
        notifyDeleted,
        notifyError,
        onAllFailed: (message) => {
          notifyError(message);
        },
        onDone: () => {
          setSelectedActiveRouteIds((current) =>
            current.filter((id) => !result.succeededIds.includes(id)),
          );
          setDeleteActiveRouteTarget(null);
          setViewActiveRoute(null);
        },
      });
    } catch {
      setDeleteActiveRouteTarget(null);
    }
  }

  const dash = t("common.empty.dash");

  const activeRouteTableColumns = useMemo(() => {
    const columns: DataTableColumn<ActiveRoute>[] = [
      {
        id: "date",
        label: t("routes.columns.date"),
        renderCell: (record) => {
          const schedule = record.date
            ? formatRouteDate(record.date)
            : record.dayOfWeek.map((day) => t(`routes.activeRoute.days.${day}`)).join(", ");
          return (
            <div className="flex items-center gap-1.5">
              <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
              {schedule || dash}
            </div>
          );
        },
      },
      {
        id: "name",
        label: t("routes.columns.name"),
        cellClassName: "font-medium",
        renderCell: (record) => formatActiveRouteRowLabel(record, dash, t),
      },
      {
        id: "branch.code",
        label: t("routes.columns.branch"),
        renderCell: (record) => record.branch?.code || dash,
      },
      {
        id: "vehicle.name",
        label: t("routes.columns.vehicle"),
        renderCell: (record) => formatActiveRouteVehicleLabel(record, dash),
      },
      {
        id: "id",
        label: t("routes.columns.recordId"),
        cellClassName: "font-mono text-xs text-muted-foreground tabular-nums",
        renderCell: (record) => record.id || dash,
      },
      {
        id: "routeType",
        label: t("routes.columns.routeType"),
        renderCell: (record) => formatActiveRouteTypeLabel(record.routeType, t),
      },
      {
        id: "container.name",
        label: t("routes.columns.container"),
        renderCell: (record) => formatActiveRouteContainerLabel(record, dash),
      },
      {
        id: "route.name",
        label: t("routes.columns.route"),
        renderCell: (record) =>
          formatActiveRouteRouteName(record, routeLookup.getByKey, dash),
      },
      {
        id: "driver.name",
        label: t("routes.columns.driver"),
        renderCell: (record) => formatActiveRouteDriverNames(record) || dash,
      },
      {
        id: "appraiser.name",
        label: t("routes.columns.appraiser"),
        renderCell: (record) => formatActiveRouteAppraiserName(record) || dash,
      },
      {
        id: "helper.name",
        label: t("routes.columns.helper"),
        renderCell: (record) => formatActiveRouteHelperNames(record) || dash,
      },
      {
        id: "createdAt",
        label: t("routes.columns.createdAt"),
        cellClassName: "text-muted-foreground",
        renderCell: (record) =>
          record.createdAt ? formatAuditDateTime(record.createdAt) : dash,
      },
    ];

    return columns.filter((column) => {
      if (column.id === "routeType" && !variant.showRouteTypeField) return false;
      if (column.id === "container.name" && !variant.showContainerField) return false;
      if (column.id === "id" && !showRecordIdColumn) return false;
      if (showRecordIdColumn && (column.id === "route.name" || column.id === "driver.name" || column.id === "appraiser.name" || column.id === "helper.name")) {
        return false;
      }
      return true;
    });
  }, [
    dash,
    routeLookup.getByKey,
    showRecordIdColumn,
    t,
    variant.id,
    variant.showContainerField,
    variant.showRouteTypeField,
  ]);

  const activeRouteColumnVisibility = useColumnVisibility(
    variant.columnVisibilityKey,
    activeRouteTableColumns,
  );

  const advancedFilterCount = countCompleteFilterRows(
    activeRouteFilters.rows,
    activeRouteFilterFields,
  );
  const hasActiveRouteFilters =
    Boolean(activeRouteFilters.query.trim()) || advancedFilterCount > 0;
  const hasBranchScope = Boolean(branchCode.trim());
  const activeRouteListSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: activeRoutes.length,
      page: currentActiveRoutePage,
      pageSize: pageLimit,
      total: totalActiveRoutes,
      noun: t(`routes.${copyPrefix}.searchNoun`),
      isFiltered: hasActiveRouteFilters || hasBranchScope,
      isLoading: !isBranchFilterReady || activeRoutesQuery.isFetching,
    },
    t,
  );

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col">
      <PageHeader
        title={t(`routes.${copyPrefix}.title`)}
        description={t(`routes.pages.${copyPrefix}`)}
        actions={
          <Button onClick={openAddActiveRoute}>
            <Plus className="h-4 w-4" />
            {t(`routes.${copyPrefix}.setActiveRoute`)}
          </Button>
        }
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={advancedFilterCount}
            columnLayout={activeRouteColumnVisibility}
            search={
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <TableSearchInput
                    value={activeRouteFilters.query}
                    onChange={(query) => {
                      setActiveRouteFilters((current) => ({ ...current, query }));
                      setActiveRoutePage(1);
                    }}
                    placeholder={t(`routes.${copyPrefix}.searchPlaceholder`)}
                  />
                </div>
                <SearchableSelect
                  id="daily-routes-branch-filter"
                  aria-label={t("routes.table.branchFilter")}
                  value={selectValue}
                  onValueChange={(nextBranchCode) => {
                    setBranchCode(nextBranchCode);
                    setActiveRoutePage(1);
                  }}
                  options={branchOptions}
                  loading={branchesLoading}
                  loadingMessage={t("common.loading")}
                  placeholder={t("routes.table.branchFilter")}
                  searchPlaceholder={t("routes.table.branchFilterSearch")}
                  truncateSelection={false}
                  fitToOptions
                  className="max-w-full shrink-0"
                />
              </div>
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={activeRouteListSummary}
                presets={{
                  storageKey: variant.columnVisibilityKey,
                  rows: activeRouteFilters.rows,
                  fields: activeRouteFilterFields,
                  onApply: (rows) => {
                    setActiveRouteFilters((current) => ({ ...current, rows }));
                    setActiveRoutePage(1);
                  },
                }}
                onClearAll={
                  hasActiveRouteFilters
                    ? () => {
                        setActiveRouteFilters(defaultActiveRouteFilters);
                        setActiveRoutePage(1);
                      }
                    : undefined
                }
              >
                <TableAdvancedFilterBuilder
                  open={filtersOpen}
                  rows={activeRouteFilters.rows}
                  fields={activeRouteFilterFields}
                  onChange={(rows) => {
                    setActiveRouteFilters((current) => ({ ...current, rows }));
                    setActiveRoutePage(1);
                  }}
                />
              </TableFilterPanel>
            }
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedActiveRouteIds}
          pageRowIds={activeRoutes.map((record) => record.id)}
          totalCount={totalActiveRoutes}
          onSelectedIdsChange={setSelectedActiveRouteIds}
          onEdit={() => {
            const record = activeRoutes.find((entry) => entry.id === selectedActiveRouteIds[0]);
            if (record) openEditActiveRoute(record);
          }}
          onDelete={() =>
            setDeleteActiveRouteTarget(
              activeRoutes.filter((record) => selectedActiveRouteIds.includes(record.id)),
            )
          }
          actions={renderSelectionActions?.({
            activeRoutes,
            selectedIds: selectedActiveRouteIds,
          })}
        />

        {activeRoutesQuery.isError ? (
          <div className="px-6 py-8 text-sm text-destructive">
            {toErrorMessage(activeRoutesQuery.error)}
          </div>
        ) : (
          <DataTable
            columns={activeRouteColumnVisibility.columns}
            rows={activeRoutes}
            page={currentActiveRoutePage}
            isPageDataPending={activeRoutesQuery.isFetching || !isBranchFilterReady}
            rowKey={(record) => record.id}
            rowLabel={(record) => formatActiveRouteRowLabel(record, dash, t)}
            columnLayout={activeRouteColumnVisibility}
            sortUnavailable
            minWidth={1200}
            selectable
            selectedIds={selectedActiveRouteIds}
            allPageSelected={allActiveRoutePageSelected}
            onToggleSelectAll={toggleActiveRouteSelectAll}
            onToggleSelect={toggleActiveRouteSelect}
            onRowClick={setViewActiveRoute}
            onRowDoubleClick={openEditActiveRoute}
            activeRowId={viewActiveRoute?.id}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveRouteFilters || hasBranchScope
                    ? t(`routes.${copyPrefix}.emptyFiltered`)
                    : t(`routes.${copyPrefix}.empty`)}
                </p>
                <Button className="mt-4" onClick={openAddActiveRoute}>
                  <Plus className="h-4 w-4" />
                  {t(`routes.${copyPrefix}.setActiveRoute`)}
                </Button>
              </>
            }
          />
        )}

        <div className="flex shrink-0 flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {t(`routes.${copyPrefix}.pagination`, {
              shown: activeRoutes.length,
              total: totalActiveRoutes,
            })}
          </p>
          <TablePaginationControls
            page={currentActiveRoutePage}
            totalPages={totalActiveRoutePages}
            pageSize={pageSize}
            onPageChange={setActiveRoutePage}
            onPageSizeChange={changePageSize}
            disabled={activeRoutesQuery.isLoading || !isBranchFilterReady}
          />
        </div>
      </Card>

      <ActiveRouteViewSheet
        record={viewActiveRoute}
        variant={variant}
        open={Boolean(viewActiveRoute)}
        onOpenChange={(open) => !open && setViewActiveRoute(null)}
        onEdit={(record) => {
          setViewActiveRoute(null);
          openEditActiveRoute(record);
        }}
        onDelete={(record) => {
          setViewActiveRoute(null);
          setDeleteActiveRouteTarget(record);
        }}
      />

      <Dialog
        open={activeRouteDialogOpen}
        onOpenChange={(open) => {
          setActiveRouteDialogOpen(open);
          if (!open) setEditingActiveRoute(null);
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {editingActiveRoute
                ? t(`routes.${copyPrefix}.editTitle`)
                : t(`routes.${copyPrefix}.title`)}
            </DialogTitle>
            <DialogDescription>{t(`routes.${copyPrefix}.description`)}</DialogDescription>
          </DialogHeader>
          <ActiveRouteSection
            key={editingActiveRoute?.id ?? `new-${variant.id}`}
            initialRecord={editingActiveRoute}
            variant={variant}
            onSaved={() => {
              setActiveRouteDialogOpen(false);
              setEditingActiveRoute(null);
            }}
            onCancel={() => {
              setActiveRouteDialogOpen(false);
              setEditingActiveRoute(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteActiveRouteTarget !== null}
        onOpenChange={(open) => !open && setDeleteActiveRouteTarget(null)}
      >
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              {Array.isArray(deleteActiveRouteTarget) && deleteActiveRouteTarget.length > 1
                ? t("common.dialogs.deleteManyTitle", {
                    entities: t(`routes.${copyPrefix}.entities.activeRoutes`),
                  })
                : t("common.dialogs.deleteOneTitle", {
                    entity: t(`routes.${copyPrefix}.entities.activeRoute`),
                  })}
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteActiveRouteTarget)
                ? t("common.dialogs.deleteManyDescription", {
                    count: deleteActiveRouteTarget.length,
                    entities: t(`routes.${copyPrefix}.entities.activeRoutes`),
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("common.dialogs.deleteOneDescription", {
                    name: deleteActiveRouteTarget
                      ? String(deleteActiveRouteTarget.name ?? "").trim() ||
                        formatActiveRouteRowLabel(deleteActiveRouteTarget, dash, t)
                      : t(`routes.${copyPrefix}.entities.activeRoute`),
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteActiveRouteTarget(null)}
              disabled={isSaving}
            >
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton isPending={isSaving} onClick={confirmDeleteActiveRoutes} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
