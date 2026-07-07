"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import { ActiveRouteSection } from "@/components/pickup-delivery-routes/pickup-delivery-route-section";
import { ActiveRouteViewSheet } from "@/components/pickup-delivery-routes/pickup-delivery-route-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
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
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
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
} from "@/lib/pickup-delivery-routes/display";
import {
  DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
  type ActiveRoute,
  type ActiveRouteFilterState,
} from "@/lib/pickup-delivery-routes/types";
import { useActiveRoutes, useDeleteActiveRoutes } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useRouteLookup } from "@/lib/route-manager/hooks/use-route-manager";
import { createApiListTextSearch } from "@/lib/api/search-query";
import { formatAuditDateTime } from "@/lib/audit/display";
import { formatRouteDate } from "@/lib/route-manager/display";
import type { ActiveRoutesDirectoryVariant } from "@/lib/pickup-delivery-routes/directory-variant";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useTranslation } from "@/lib/i18n";

const ACTIVE_ROUTE_PAGE_SIZE = DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultActiveRouteFilters: ActiveRouteFilterState = {
  query: "",
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
  const { notifyDeleted } = useFeedback();
  const [activeRouteFilters, setActiveRouteFilters] =
    useState<ActiveRouteFilterState>(defaultActiveRouteFilters);
  const debouncedActiveRouteQuery = useDebouncedValue(activeRouteFilters.query, SEARCH_DEBOUNCE_MS);
  const isActiveRouteSearchPending =
    activeRouteFilters.query.trim() !== debouncedActiveRouteQuery.trim();
  const [selectedActiveRouteIds, setSelectedActiveRouteIds] = useState<string[]>([]);
  const [activeRoutePage, setActiveRoutePage] = useState(1);
  const [activeRouteDialogOpen, setActiveRouteDialogOpen] = useState(false);
  const [editingActiveRoute, setEditingActiveRoute] = useState<ActiveRoute | null>(null);
  const [deleteActiveRouteTarget, setDeleteActiveRouteTarget] = useState<
    ActiveRoute | ActiveRoute[] | null
  >(null);
  const [viewActiveRoute, setViewActiveRoute] = useState<ActiveRoute | null>(null);

  const activeRouteListParams = useMemo(
    () => ({
      ...DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
      page: activeRoutePage,
      limit: ACTIVE_ROUTE_PAGE_SIZE,
      routeType: variant.routeType,
      search: createApiListTextSearch(debouncedActiveRouteQuery),
    }),
    [activeRoutePage, debouncedActiveRouteQuery, variant.routeType],
  );

  const activeRoutesQuery = useActiveRoutes(activeRouteListParams);
  const deleteActiveRoutesMutation = useDeleteActiveRoutes(variant.routeType);
  const routeLookup = useRouteLookup(200, {
    branchCode: variant.fixedBranchCode,
    enabled: variant.id === "delivery",
  });

  const activeRoutes = useResolvedPaginatedItems(
    activeRoutesQuery.data?.items,
    activeRoutesQuery.data?.total,
    activeRoutesQuery.isFetching,
  );
  const totalActiveRoutes = activeRoutesQuery.data?.total ?? 0;
  const totalActiveRoutePages = Math.max(1, Math.ceil(totalActiveRoutes / ACTIVE_ROUTE_PAGE_SIZE));
  const currentActiveRoutePage = Math.min(activeRoutePage, totalActiveRoutePages);

  const allActiveRoutePageSelected =
    activeRoutes.length > 0 &&
    activeRoutes.every((record) => selectedActiveRouteIds.includes(record.id));
  const isSaving = deleteActiveRoutesMutation.isPending;

  useTableSelectionReset(
    buildTableSelectionResetKey(debouncedActiveRouteQuery, variant.routeType),
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
      await deleteActiveRoutesMutation.mutateAsync(ids);
      setSelectedActiveRouteIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteActiveRouteTarget(null);
      setViewActiveRoute(null);
      notifyDeleted(t(`routes.${copyPrefix}.entities.activeRoute`), ids.length);
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
          variant.id === "delivery"
            ? formatActiveRouteRouteName(record, routeLookup.getByKey, dash)
            : record.route.name || dash,
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

  const hasActiveRouteFilters = Boolean(activeRouteFilters.query.trim());
  const activeRouteSearchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveRouteFilters,
      query: activeRouteFilters.query,
      isSearchPending: isActiveRouteSearchPending,
      matched: totalActiveRoutes,
      noun: t(`routes.${copyPrefix}.searchNoun`),
      isLoading: activeRoutesQuery.isFetching && activeRoutes.length === 0,
    },
    t,
  );

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col">
      <PageHeader
        title={t(`routes.${copyPrefix}.title`)}
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
            showFilterToggle={false}
            columnLayout={activeRouteColumnVisibility}
            searchSummary={activeRouteSearchSummary}
            search={
              <TableSearchInput
                value={activeRouteFilters.query}
                onChange={(query) => {
                  setActiveRouteFilters((current) => ({ ...current, query }));
                  setActiveRoutePage(1);
                }}
                placeholder={t(`routes.${copyPrefix}.searchPlaceholder`)}
              />
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
            isPageDataPending={activeRoutesQuery.isFetching}
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
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveRouteFilters
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentActiveRoutePage <= 1 || activeRoutesQuery.isLoading}
              onClick={() => setActiveRoutePage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              {t("common.actions.previous")}
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              {t("common.pagination.pageOf", {
                current: currentActiveRoutePage,
                total: totalActiveRoutePages,
              })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={
                currentActiveRoutePage >= totalActiveRoutePages || activeRoutesQuery.isLoading
              }
              onClick={() =>
                setActiveRoutePage((value) => Math.min(totalActiveRoutePages, value + 1))
              }
            >
              {t("common.actions.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
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
            <Button variant="destructive" onClick={confirmDeleteActiveRoutes} disabled={isSaving}>
              <Trash2 className="h-4 w-4" />
              {t("common.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
