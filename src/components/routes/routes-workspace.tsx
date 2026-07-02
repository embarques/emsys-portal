"use client";

import { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import { ActiveRouteSection } from "@/components/routes/active-route-section";
import { RouteForm } from "@/components/routes/route-form";
import { RouteViewSheet } from "@/components/routes/route-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import {
  formatActiveRouteContainerLabel,
  formatActiveRouteRowLabel,
  formatActiveRouteTypeLabel,
} from "@/lib/active-routes/display";
import {
  DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
  type ActiveRoute,
  type ActiveRouteFilterState,
} from "@/lib/active-routes/types";
import { useActiveRoutes, useDeleteActiveRoutes } from "@/lib/active-routes/hooks/use-active-routes";
import { createApiListTextSearch } from "@/lib/api/search-query";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  formatRouteDate,
  formatRouteName,
  getRouteEmployeesLabel,
} from "@/lib/routes/display";
import {
  useCreateRoute,
  useDeleteRoutes,
  useRoutes,
  useUpdateRoute,
} from "@/lib/routes/hooks/use-routes";
import {
  DEFAULT_ROUTE_LIST_PARAMS,
  createEmptyRouteForm,
  routeToFormValues,
  type Route,
  type RouteFilterState,
  type RouteFormValues,
} from "@/lib/routes/types";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { useTranslation } from "@/lib/i18n";

const PAGE_SIZE = DEFAULT_ROUTE_LIST_PARAMS.limit;
const ACTIVE_ROUTE_PAGE_SIZE = DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: RouteFilterState = {
  query: "",
};

const defaultActiveRouteFilters: ActiveRouteFilterState = {
  query: "",
};

export function RoutesWorkspace() {
  const { t } = useTranslation();
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<RouteFilterState>(defaultFilters);
  const [activeRouteFilters, setActiveRouteFilters] =
    useState<ActiveRouteFilterState>(defaultActiveRouteFilters);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const debouncedActiveRouteQuery = useDebouncedValue(activeRouteFilters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const isActiveRouteSearchPending =
    activeRouteFilters.query.trim() !== debouncedActiveRouteQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedActiveRouteIds, setSelectedActiveRouteIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [activeRoutePage, setActiveRoutePage] = useState(1);
  const [activeRouteDialogOpen, setActiveRouteDialogOpen] = useState(false);
  const [editingActiveRoute, setEditingActiveRoute] = useState<ActiveRoute | null>(null);
  const [deleteActiveRouteTarget, setDeleteActiveRouteTarget] = useState<
    ActiveRoute | ActiveRoute[] | null
  >(null);
  const [viewAssignment, setViewAssignment] = useState<Route | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Route | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Route | Route[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () => ({
      ...DEFAULT_ROUTE_LIST_PARAMS,
      page,
      limit: PAGE_SIZE,
      search: createApiListTextSearch(debouncedQuery),
    }),
    [debouncedQuery, page],
  );

  const activeRouteListParams = useMemo(
    () => ({
      ...DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
      page: activeRoutePage,
      limit: ACTIVE_ROUTE_PAGE_SIZE,
      search: createApiListTextSearch(debouncedActiveRouteQuery),
    }),
    [activeRoutePage, debouncedActiveRouteQuery],
  );

  const { data, isLoading, isError, error, isFetching } = useRoutes(listParams);
  const activeRoutesQuery = useActiveRoutes(activeRouteListParams);
  const createMutation = useCreateRoute();
  const updateMutation = useUpdateRoute();
  const deleteMutation = useDeleteRoutes();
  const deleteActiveRoutesMutation = useDeleteActiveRoutes();

  const assignments = data?.items ?? [];
  const totalAssignments = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalAssignments / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const activeRoutes = activeRoutesQuery.data?.items ?? [];
  const totalActiveRoutes = activeRoutesQuery.data?.total ?? 0;
  const totalActiveRoutePages = Math.max(1, Math.ceil(totalActiveRoutes / ACTIVE_ROUTE_PAGE_SIZE));
  const currentActiveRoutePage = Math.min(activeRoutePage, totalActiveRoutePages);

  const allPageSelected =
    assignments.length > 0 && assignments.every((assignment) => selectedIds.includes(assignment.id));
  const allActiveRoutePageSelected =
    activeRoutes.length > 0 &&
    activeRoutes.every((record) => selectedActiveRouteIds.includes(record.id));
  const isSaving =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    deleteActiveRoutesMutation.isPending;

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...assignments.map((assignment) => assignment.id)])),
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !assignments.some((assignment) => assignment.id === id)),
    );
  }

  function toggleSelect(assignmentId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, assignmentId] : current.filter((entry) => entry !== assignmentId),
    );
  }

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

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({
        feature: "routes",
        baseHref: "/routes",
        mode: "add",
        label: "Add route",
      });
      return;
    }
    setEditingAssignment(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(assignment: Route) {
    if (isDesktopTabs) {
      setViewAssignment(null);
      openFormTab({
        feature: "routes",
        baseHref: "/routes",
        mode: "edit",
        entityId: assignment.id,
        label: `Edit ${formatRouteName(assignment)}`,
      });
      return;
    }
    setEditingAssignment(assignment);
    setFormMode("edit");
    setViewAssignment(null);
    setFormError(null);
  }

  async function saveAssignment(values: RouteFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingAssignment) {
        const nextAssignment = await updateMutation.mutateAsync({
          recordId: editingAssignment.id,
          values,
        });
        notifyUpdated("Route", formatRouteName(nextAssignment));
      } else {
        const nextAssignment = await createMutation.mutateAsync(values);
        notifyAdded("Route", formatRouteName(nextAssignment));
      }

      setFormMode(null);
      setEditingAssignment(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  function openEditActiveRoute(record: ActiveRoute) {
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
      notifyDeleted(t("routes.entities.activeRoute"), ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteActiveRouteTarget(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((assignment) => assignment.id)
      : [deleteTarget.id];

    try {
      await deleteMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewAssignment(null);
      notifyDeleted("Route", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const tableColumns: DataTableColumn<Route>[] = [
    {
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (assignment) => formatRouteName(assignment),
    },
    {
      id: "employees",
      label: "employees",
      renderCell: (assignment) => getRouteEmployeesLabel(assignment.employees),
    },
    {
      id: "vehicle.name",
      label: "vehicle.name",
      renderCell: (assignment) => assignment.vehicle.name || "—",
    },
    {
      id: "createdAt",
      label: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (assignment) =>
        assignment.createdAt ? formatAuditDateTime(assignment.createdAt) : "—",
    },
    {
      id: "createdBy",
      label: "createdBy",
      cellClassName: "text-muted-foreground",
      renderCell: (assignment) => assignment.createdBy || "—",
    },
    {
      id: "updatedAt",
      label: "updatedAt",
      cellClassName: "text-muted-foreground",
      renderCell: (assignment) => (assignment.updatedAt ? formatAuditDateTime(assignment.updatedAt) : "—"),
    },
  ];

  const columnVisibility = useColumnVisibility("routes-v2", tableColumns);

  const activeRouteTableColumns: DataTableColumn<ActiveRoute>[] = [
    {
      id: "date",
      label: "date",
      renderCell: (record) => (
        <div className="flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
          {formatRouteDate(record.date)}
        </div>
      ),
    },
    {
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (record) => formatActiveRouteRowLabel(record),
    },
    {
      id: "routeType",
      label: "routeType",
      renderCell: (record) => formatActiveRouteTypeLabel(record.routeType, t),
    },
    {
      id: "container.name",
      label: "container",
      renderCell: (record) => formatActiveRouteContainerLabel(record),
    },
    {
      id: "route.name",
      label: "route",
      renderCell: (record) => record.route.name || "—",
    },
    {
      id: "driver.name",
      label: "driver",
      renderCell: (record) => record.driver?.name || "—",
    },
    {
      id: "appraiser.name",
      label: "appraiser",
      renderCell: (record) => record.appraiser?.name || "—",
    },
    {
      id: "createdAt",
      label: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (record) =>
        record.createdAt ? formatAuditDateTime(record.createdAt) : "—",
    },
  ];

  const activeRouteColumnVisibility = useColumnVisibility(
    "active-routes-v1",
    activeRouteTableColumns,
  );

  const hasActiveFilters = Boolean(filters.query.trim());
  const hasActiveRouteFilters = Boolean(activeRouteFilters.query.trim());
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    isSearchPending,
    matched: totalAssignments,
    noun: "assignments",
    isLoading: isFetching && assignments.length === 0,
  });
  const activeRouteSearchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveRouteFilters,
    query: activeRouteFilters.query,
    isSearchPending: isActiveRouteSearchPending,
    matched: totalActiveRoutes,
    noun: "active routes",
    isLoading: activeRoutesQuery.isFetching && activeRoutes.length === 0,
  });

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col">
      <PageHeader
        title="Routes"
        actions={
          <>
            <Button variant="outline" onClick={() => openActiveRouteDialog(null)}>
              <Plus className="h-4 w-4" />
              {t("routes.activeRoutesTable.setActiveRoute")}
            </Button>
            <Button onClick={openAddForm}>
              <Plus className="h-4 w-4" />
              Add route
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <Card className="flex min-h-0 flex-1 basis-0 flex-col gap-0 py-0">
          <CardHeader className="gap-3 border-b py-4 pb-3">
            <CardTitle className="text-base">{t("routes.tabs.activeRoutes")}</CardTitle>
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
                  placeholder={t("routes.activeRoutesTable.searchPlaceholder")}
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
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeRoutesQuery.isError ? (
              <div className="px-6 py-8 text-sm text-destructive">
                {normalizeApiError(activeRoutesQuery.error).message}
              </div>
            ) : (
              <DataTable
                columns={activeRouteColumnVisibility.columns}
                rows={activeRoutes}
                page={currentActiveRoutePage}
                isPageDataPending={activeRoutesQuery.isFetching}
                rowKey={(record) => record.id}
                rowLabel={(record) => formatActiveRouteRowLabel(record)}
                columnLayout={activeRouteColumnVisibility}
                sortUnavailable
                minWidth={1200}
                selectable
                selectedIds={selectedActiveRouteIds}
                allPageSelected={allActiveRoutePageSelected}
                onToggleSelectAll={toggleActiveRouteSelectAll}
                onToggleSelect={toggleActiveRouteSelect}
                onRowClick={openEditActiveRoute}
                onRowDoubleClick={openEditActiveRoute}
                emptyState={
                  <>
                    <p className="text-muted-foreground">
                      {hasActiveRouteFilters
                        ? t("routes.activeRoutesTable.emptyFiltered")
                        : t("routes.activeRoutesTable.empty")}
                    </p>
                    <Button className="mt-4" onClick={() => openActiveRouteDialog(null)}>
                      <Plus className="h-4 w-4" />
                      {t("routes.activeRoutesTable.setActiveRoute")}
                    </Button>
                  </>
                }
              />
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t("routes.activeRoutesTable.pagination", {
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
                Previous
              </Button>
              <span className="px-2 text-sm text-muted-foreground">
                Page {currentActiveRoutePage} of {totalActiveRoutePages}
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
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-1 basis-0 flex-col gap-0 py-0">
          <CardHeader className="gap-3 border-b py-4 pb-3">
            <CardTitle className="text-base">{t("routes.tabs.routes")}</CardTitle>
            <TableDirectoryToolbar
              showFilterToggle={false}
              columnLayout={columnVisibility}
              searchSummary={searchSummary}
              search={
                <TableSearchInput
                  value={filters.query}
                  onChange={(query) => {
                    setFilters((current) => ({ ...current, query }));
                    setPage(1);
                  }}
                  placeholder="Search routes..."
                />
              }
            />
          </CardHeader>

          <TableSelectionToolbar
            selectedIds={selectedIds}
            pageRowIds={assignments.map((assignment) => assignment.id)}
            totalCount={totalAssignments}
            onSelectedIdsChange={setSelectedIds}
            onEdit={() => {
              const assignment = assignments.find((entry) => entry.id === selectedIds[0]);
              if (assignment) openEditForm(assignment);
            }}
            onDelete={() =>
              setDeleteTarget(
                assignments.filter((assignment) => selectedIds.includes(assignment.id)),
              )
            }
          />

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isError ? (
              <div className="px-6 py-8 text-sm text-destructive">
                {normalizeApiError(error).message}
              </div>
            ) : (
              <DataTable
                columns={columnVisibility.columns}
                rows={assignments}
                page={currentPage}
                isPageDataPending={isFetching}
                rowKey={(assignment) => assignment.id}
                rowLabel={(assignment) => formatRouteName(assignment)}
                columnLayout={columnVisibility}
                sortUnavailable
                minWidth={1500}
                selectable
                selectedIds={selectedIds}
                allPageSelected={allPageSelected}
                onToggleSelectAll={toggleSelectAll}
                onToggleSelect={toggleSelect}
                onRowClick={setViewAssignment}
                onRowDoubleClick={openEditForm}
                emptyState={
                  <>
                    <p className="text-muted-foreground">
                      {hasActiveFilters ? "No routes match your search." : "No routes yet."}
                    </p>
                    <Button className="mt-4" onClick={openAddForm}>
                      <Plus className="h-4 w-4" />
                      Add route
                    </Button>
                  </>
                }
              />
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {assignments.length} of {totalAssignments} assignments
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="px-2 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

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
                ? t("routes.activeRoute.editTitle")
                : t("routes.activeRoute.title")}
            </DialogTitle>
            <DialogDescription>{t("routes.activeRoute.description")}</DialogDescription>
          </DialogHeader>
          <ActiveRouteSection
            key={editingActiveRoute?.id ?? "new-active-route"}
            initialRecord={editingActiveRoute}
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

      <RouteViewSheet
        assignment={viewAssignment}
        open={Boolean(viewAssignment)}
        onOpenChange={(open) => {
          if (!open) setViewAssignment(null);
        }}
        onEdit={openEditForm}
        onDelete={(assignment) => {
          setViewAssignment(null);
          setDeleteTarget(assignment);
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
              {formMode === "edit"
                ? t("routes.form.editTitle")
                : t("routes.form.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {formMode === "edit"
                ? t("routes.form.editDescription")
                : t("routes.form.addDescription")}
            </DialogDescription>
          </DialogHeader>
          <RouteForm
            key={editingAssignment?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingAssignment
                ? routeToFormValues(editingAssignment)
                : createEmptyRouteForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={
              formMode === "edit"
                ? t("common.actions.saveChanges")
                : t("routes.form.addTitle")
            }
            isSubmitting={isSaving}
            externalError={formError}
            onSubmit={saveAssignment}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
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
                    entities: t("routes.entities.activeRoutes"),
                  })
                : t("common.dialogs.deleteOneTitle", {
                    entity: t("routes.entities.activeRoute"),
                  })}
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteActiveRouteTarget)
                ? t("common.dialogs.deleteManyDescription", {
                    count: deleteActiveRouteTarget.length,
                    entities: t("routes.entities.activeRoutes"),
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("common.dialogs.deleteOneDescription", {
                    name: deleteActiveRouteTarget
                      ? String(deleteActiveRouteTarget.name ?? "").trim() ||
                        formatActiveRouteRowLabel(deleteActiveRouteTarget)
                      : t("routes.entities.activeRoute"),
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

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              Delete route{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected assignments. This action cannot be undone.`
                : `This will permanently remove ${deleteTarget?.name ?? "this assignment"}. This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isSaving}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
