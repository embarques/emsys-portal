"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Route as RouteIcon,
  Trash2,
} from "lucide-react";

import { RouteForm } from "@/components/routes/route-form";
import { RouteViewSheet } from "@/components/routes/route-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";

import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
  TableFilterSection,
} from "@/components/app-shell/table-directory-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Badge } from "@/components/ui/badge";
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
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeRouteKpis,
  formatRouteDate,
  formatRoutePlacesSummary,
  getPlaceKindBadgeClass,
  getPlaceKindLabel,
  getRouteBranchBadgeClass,
  getRouteBranchLabel,
  routeMatchesQuery,
  truncateRouteId,
} from "@/lib/routes/display";
import { cloneRoutes } from "@/lib/routes/mock-data";
import {
  ROUTE_BRANCHES,
  ROUTE_PLACE_KINDS,
  createEmptyRouteForm,
  formValuesToRoute,
  routeToFormValues,
  type RouteFilterState,
  type RouteFormValues,
  type RouteRecord,
} from "@/lib/routes/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 8;

const defaultFilters: RouteFilterState = {
  query: "",
  placeKind: "all",
  branch: "all",
};

export function RoutesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [routes, setRoutes] = useState<RouteRecord[]>(() => cloneRoutes());
  const [filters, setFilters] = useState<RouteFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewRoute, setViewRoute] = useState<RouteRecord | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingRoute, setEditingRoute] = useState<RouteRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RouteRecord | RouteRecord[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredRoutes = useMemo(() => {
    return routes.filter((route) => {
      if (!routeMatchesQuery(route, filters.query)) return false;
      if (filters.branch !== "all" && route.branch !== filters.branch) return false;
      if (filters.placeKind !== "all" && !route.places.some((place) => place.kind === filters.placeKind)) {
        return false;
      }
      return true;
    });
  }, [filters, routes]);

  const kpis = useMemo(() => computeRouteKpis(routes), [routes]);
  const totalPages = Math.max(1, Math.ceil(filteredRoutes.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRoutes = filteredRoutes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected = pageRoutes.length > 0 && pageRoutes.every((route) => selectedIds.includes(route.routeId));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...pageRoutes.map((route) => route.routeId)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !pageRoutes.some((route) => route.routeId === id)));
  }

  function toggleSelect(routeId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, routeId] : current.filter((entry) => entry !== routeId)));
  }

  function openAddForm() {
    setEditingRoute(null);
    setFormMode("add");
  }

  function openEditForm(route: RouteRecord) {
    setEditingRoute(route);
    setFormMode("edit");
    setViewRoute(null);
  }

  function saveRoute(values: RouteFormValues) {
    if (formMode === "edit" && editingRoute) {
      const nextRoute = formValuesToRoute(
        values,
        editingRoute.createdAt,
        editingRoute.createdBy,
        new Date().toISOString()
      );
      setRoutes((current) =>
        current.map((route) => (route.routeId === editingRoute.routeId ? nextRoute : route))
      );
      notifyUpdated("Route", nextRoute.name);
    } else {
      const nextRoute = formValuesToRoute(values);
      setRoutes((current) => [nextRoute, ...current]);
      notifyAdded("Route", nextRoute.name);
    }

    setFormMode(null);
    setEditingRoute(null);
    setPage(1);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget.map((route) => route.routeId) : [deleteTarget.routeId];
    setRoutes((current) => current.filter((route) => !ids.includes(route.routeId)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewRoute(null);
    notifyDeleted("Route", ids.length);
  }

  const stats = [
    { label: "Total routes", value: kpis.total.toString(), description: "Defined delivery routes", icon: RouteIcon },
    { label: "USA", value: kpis.usa.toString(), description: "United States branch", icon: MapPin },
    { label: "DR", value: kpis.dr.toString(), description: "Dominican Republic branch", icon: MapPin },
  ];

  const placeKindFilters: { value: RouteFilterState["placeKind"]; label: string }[] = [
    { value: "all", label: "All" },
    ...ROUTE_PLACE_KINDS.map((entry) => ({ value: entry.value, label: entry.label })),
  ];

  const branchFilters: { value: RouteFilterState["branch"]; label: string }[] = [
    { value: "all", label: "All" },
    ...ROUTE_BRANCHES,
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
      cellClassName: "font-medium",
      renderCell: (route) => route.name,
    },
    {
      id: "branch",
      label: "Branch",
      renderCell: (route) => (
        <Badge className={getRouteBranchBadgeClass(route.branch)}>{getRouteBranchLabel(route.branch)}</Badge>
      ),
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (route) => formatRouteDate(route.createdAt),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (route) => route.createdBy,
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (route) => formatAuditDate(route.updatedAt),
    },
    {
      id: "content",
      label: "Content",
      renderCell: (route) => formatRoutePlacesSummary(route),
    },
    {
      id: "places",
      label: "Places",
      renderCell: (route) => (
        <div className="flex flex-wrap gap-1">
          {route.places.slice(0, 2).map((place) => (
            <Badge key={place.id} className={getPlaceKindBadgeClass(place.kind)}>
              {getPlaceKindLabel(place.kind)}
            </Badge>
          ))}
          {route.places.length > 2 ? (
            <Badge variant="outline">+{route.places.length - 2}</Badge>
          ) : null}
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("routes", tableColumns);
  const activeFilterCount =
    (filters.branch !== "all" ? 1 : 0) + (filters.placeKind !== "all" ? 1 : 0);
  const hasActiveFilters =
    Boolean(filters.query.trim()) || filters.branch !== "all" || filters.placeKind !== "all";

  return (
    <div>
      <PageHeader
        title="Routes"
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add route
          </Button>
        }
      />

      <StatCardsGrid>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <CardDescription className="mt-1">{stat.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </StatCardsGrid>

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            columnLayout={columnVisibility}
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
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${filteredRoutes.length} of ${routes.length} routes`}
                onClearAll={
                  hasActiveFilters
                    ? () => {
                        setFilters(defaultFilters);
                        setPage(1);
                      }
                    : undefined
                }
              >
            <TableFilterSection label="Branch">
              {branchFilters.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={filters.branch === option.value ? "default" : "outline"}
                  onClick={() => {
                    setFilters((current) => ({ ...current, branch: option.value }));
                    setPage(1);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </TableFilterSection>

            <TableFilterSection label="Contains">
              {placeKindFilters.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={filters.placeKind === option.value ? "default" : "outline"}
                  onClick={() => {
                    setFilters((current) => ({ ...current, placeKind: option.value }));
                    setPage(1);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </TableFilterSection>
              </TableFilterPanel>
            }
          />
        </CardHeader>

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={pageRoutes.map((route) => route.routeId)}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const route = pageRoutes.find((entry) => entry.routeId === selectedIds[0]);
            if (route) openEditForm(route);
          }}
          onDelete={() => setDeleteTarget(routes.filter((route) => selectedIds.includes(route.routeId)))}
        />

        <DataTable
          columns={columnVisibility.columns}
          rows={pageRoutes}
          page={currentPage}
          rowKey={(route) => route.routeId}
          rowLabel={(route) => route.name}
          columnLayout={columnVisibility}
          minWidth={1050}
          selectable
          selectedIds={selectedIds}
          allPageSelected={allPageSelected}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelect}
          onRowClick={setViewRoute}
          onRowDoubleClick={openEditForm}
          emptyState={
            <>
              <p className="text-muted-foreground">No routes match your search or filters.</p>
              <Button className="mt-4" onClick={openAddForm}>
                <Plus className="h-4 w-4" />
                Add route
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageRoutes.length} of {filteredRoutes.length} routes
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

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit route" : "Add route"}</DialogTitle>
            <DialogDescription>
              {formMode === "edit"
                ? "Update the route name and its cities, states, zip codes, or zip ranges."
                : "Create a new route with a generated route ID and place list."}
            </DialogDescription>
          </DialogHeader>
          <RouteForm
            key={editingRoute?.routeId ?? "new"}
            initialValues={
              formMode === "edit" && editingRoute ? routeToFormValues(editingRoute) : createEmptyRouteForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingRoute?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add route"}
            onSubmit={saveRoute}
            onCancel={() => setFormMode(null)}
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
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
