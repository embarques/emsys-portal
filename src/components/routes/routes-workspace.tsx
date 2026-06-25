"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Hash,
  MapPin,
  Plus,
  Route as RouteIcon,
  Trash2,
} from "lucide-react";

import { RouteForm } from "@/components/routes/route-form";
import { RouteViewSheet } from "@/components/routes/route-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";

import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeRouteKpis,
  formatRouteDate,
  formatRoutePlacesSummary,
  getPlaceKindBadgeClass,
  getPlaceKindLabel,
  getRouteKinds,
  truncateRouteId,
} from "@/lib/routes/display";
import {
  useCreateRoute,
  useDeleteRoutes,
  useRouteKpis,
  useRouteStats,
  useRoutes,
  useUpdateRoute,
} from "@/lib/routes/hooks/use-routes";
import {
  DEFAULT_ROUTE_LIST_PARAMS,
  buildRouteListParams,
  createEmptyRouteForm,
  routeToFormValues,
  type RouteFilterState,
  type RouteFormValues,
  type RouteRecord,
} from "@/lib/routes/types";
import type { DataTableColumn } from "@/lib/table/types";
import { useTableSort } from "@/lib/table/use-table-sort";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";

const PAGE_SIZE = 8;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: RouteFilterState = {
  query: "",
};

export function RoutesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<RouteFilterState>(defaultFilters);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_ROUTE_LIST_PARAMS.sort, () => setPage(1));
  const [viewRoute, setViewRoute] = useState<RouteRecord | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingRoute, setEditingRoute] = useState<RouteRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RouteRecord | RouteRecord[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () => buildRouteListParams({ page, limit: PAGE_SIZE, query: debouncedQuery, sort }),
    [debouncedQuery, page, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useRoutes(listParams);
  const stats = useRouteStats();
  const kpiQuery = useRouteKpis();
  const createRouteMutation = useCreateRoute();
  const updateRouteMutation = useUpdateRoute();
  const deleteRoutesMutation = useDeleteRoutes();

  const routes = data?.items ?? [];
  const totalRoutes = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRoutes / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected = routes.length > 0 && routes.every((route) => selectedIds.includes(route.routeId));
  const isSaving =
    createRouteMutation.isPending || updateRouteMutation.isPending || deleteRoutesMutation.isPending;

  const kpis = useMemo(() => computeRouteKpis(kpiQuery.routes), [kpiQuery.routes]);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...routes.map((route) => route.routeId)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !routes.some((route) => route.routeId === id)));
  }

  function toggleSelect(routeId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, routeId] : current.filter((entry) => entry !== routeId)));
  }

  function openAddForm() {
    setEditingRoute(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(route: RouteRecord) {
    setEditingRoute(route);
    setFormMode("edit");
    setViewRoute(null);
    setFormError(null);
  }

  async function saveRoute(values: RouteFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingRoute) {
        const nextRoute = await updateRouteMutation.mutateAsync({ routeId: editingRoute.routeId, values });
        notifyUpdated("Route", nextRoute.name || truncateRouteId(nextRoute.routeId));
      } else {
        const nextRoute = await createRouteMutation.mutateAsync(values);
        notifyAdded("Route", nextRoute.name || truncateRouteId(nextRoute.routeId));
      }

      setFormMode(null);
      setEditingRoute(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((route) => route.routeId) : [deleteTarget.routeId];

    try {
      await deleteRoutesMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewRoute(null);
      notifyDeleted("Route", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const statCards = [
    {
      label: "Total routes",
      value: stats.isLoading ? "…" : stats.total.toString(),
      description: "Defined pickup routes",
      icon: RouteIcon,
    },
    {
      label: "Cities covered",
      value: kpiQuery.isLoading ? "…" : kpis.cities.toString(),
      description: "City stops across routes",
      icon: MapPin,
    },
    {
      label: "Zip rules",
      value: kpiQuery.isLoading ? "…" : kpis.zipRules.toString(),
      description: "Zip codes and ranges",
      icon: Hash,
    },
  ];

  const tableColumns: DataTableColumn<RouteRecord>[] = [
    {
      id: "routeId",
      label: "Route ID",
      cellClassName: "font-mono text-xs",
      renderCell: (route) => truncateRouteId(route.routeId),
    },
    {
      id: "name",
      label: "Name",
      sortField: "name",
      cellClassName: "font-medium",
      renderCell: (route) => route.name || "—",
    },
    {
      id: "createdAt",
      label: "Date created",
      sortField: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (route) => formatRouteDate(route.createdAt),
    },
    {
      id: "updatedAt",
      label: "Date modified",
      sortField: "updatedAt",
      cellClassName: "text-muted-foreground",
      renderCell: (route) => formatAuditDate(route.updatedAt),
    },
    {
      id: "content",
      label: "Content",
      renderCell: (route) => formatRoutePlacesSummary(route),
    },
    {
      id: "kinds",
      label: "Types",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (route) => {
        const kinds = getRouteKinds(route);
        if (kinds.length === 0) return "—";
        return (
          <div className="flex flex-wrap gap-x-2 gap-y-0.5">
            {kinds.map((kind) => (
              <TableTagText key={kind} className={getPlaceKindBadgeClass(kind)}>
                {getPlaceKindLabel(kind)}
              </TableTagText>
            ))}
          </div>
        );
      },
    },
  ];

  const columnVisibility = useColumnVisibility("routes-v2", tableColumns);
  const hasActiveFilters = Boolean(filters.query.trim());
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    isSearchPending,
    matched: totalRoutes,
    catalogTotal: stats.total,
    noun: "routes",
    isLoading: isFetching && routes.length === 0,
    catalogLoading: stats.isLoading,
  });

  return (
    <div>
      <PageHeader
        title="Routes"
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add route
          </Button>
        }
      />

      <StatCardsGrid>
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <CardDescription className="mt-1">{card.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </StatCardsGrid>

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            showFilterToggle={false}
            columnLayout={columnVisibility}
            searchSummary={searchSummary}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters({ query });
                  setPage(1);
                }}
                placeholder="Search routes..."
              />
            }
          />
        </CardHeader>

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={routes.map((route) => route.routeId)}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const route = routes.find((entry) => entry.routeId === selectedIds[0]);
            if (route) openEditForm(route);
          }}
          onDelete={() => setDeleteTarget(routes.filter((route) => selectedIds.includes(route.routeId)))}
        />

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : null}

        {isLoading ? (
          <DirectoryTableLoader
            icon={RouteIcon}
            title="Loading routes"
            description="Organizing route names, cities, and zip coverage…"
            columns={["Route", "Name", "Created", "Updated", "Content"]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={routes}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(route) => route.routeId}
            rowLabel={(route) => route.name}
            columnLayout={columnVisibility}
            sort={sort}
            onSortChange={onSortChange}
            minWidth={1000}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewRoute}
            onRowDoubleClick={openEditForm}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {filters.query.trim() ? "No routes match your search." : "No routes yet."}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add route
                </Button>
              </>
            }
          />
        )}

        {!isLoading ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {routes.length} of {totalRoutes} routes
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
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
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <RouteViewSheet
        route={viewRoute}
        open={Boolean(viewRoute)}
        onOpenChange={(open) => {
          if (!open) setViewRoute(null);
        }}
        onEdit={openEditForm}
        onDelete={(route) => {
          setViewRoute(null);
          setDeleteTarget(route);
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
            <DialogTitle>{formMode === "edit" ? "Edit route" : "Add route"}</DialogTitle>
          </DialogHeader>
          <RouteForm
            key={editingRoute?.routeId ?? "new"}
            initialValues={
              formMode === "edit" && editingRoute ? routeToFormValues(editingRoute) : createEmptyRouteForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingRoute?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add route"}
            externalError={formError}
            isSubmitting={isSaving}
            onSubmit={saveRoute}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>Delete route{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected routes. This action cannot be undone.`
                : `This will permanently remove ${deleteTarget?.name ?? "this route"}. This action cannot be undone.`}
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
