"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  Car,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  Trash2,
  UsersRound,
} from "lucide-react";

import { RouteAssignmentForm } from "@/components/route-assignments/route-assignment-form";
import { RouteAssignmentViewSheet } from "@/components/route-assignments/route-assignment-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
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
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { createApiListTextSearch } from "@/lib/api/search-query";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  formatRouteAssignmentDate,
  formatRouteAssignmentName,
} from "@/lib/route-assignments/display";
import {
  useCreateRouteAssignment,
  useDeleteRouteAssignments,
  useRouteAssignmentKpis,
  useRouteAssignments,
  useUpdateRouteAssignment,
} from "@/lib/route-assignments/hooks/use-route-assignments";
import {
  DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS,
  createEmptyRouteAssignmentForm,
  routeAssignmentToFormValues,
  type RouteAssignment,
  type RouteAssignmentFilterState,
  type RouteAssignmentFormValues,
} from "@/lib/route-assignments/types";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";

const PAGE_SIZE = DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: RouteAssignmentFilterState = {
  query: "",
};

export function RouteAssignmentsWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<RouteAssignmentFilterState>(defaultFilters);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewAssignment, setViewAssignment] = useState<RouteAssignment | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<RouteAssignment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RouteAssignment | RouteAssignment[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () => ({
      ...DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS,
      page,
      limit: PAGE_SIZE,
      search: createApiListTextSearch(debouncedQuery),
    }),
    [debouncedQuery, page],
  );

  const { data, isLoading, isError, error, isFetching } = useRouteAssignments(listParams);
  const kpis = useRouteAssignmentKpis();
  const createMutation = useCreateRouteAssignment();
  const updateMutation = useUpdateRouteAssignment();
  const deleteMutation = useDeleteRouteAssignments();

  const assignments = data?.items ?? [];
  const totalAssignments = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalAssignments / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    assignments.length > 0 && assignments.every((assignment) => selectedIds.includes(assignment.id));
  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

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

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({
        feature: "route-assignments",
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

  function openEditForm(assignment: RouteAssignment) {
    if (isDesktopTabs) {
      setViewAssignment(null);
      openFormTab({
        feature: "route-assignments",
        baseHref: "/routes",
        mode: "edit",
        entityId: assignment.id,
        label: `Edit ${formatRouteAssignmentName(assignment)}`,
      });
      return;
    }
    setEditingAssignment(assignment);
    setFormMode("edit");
    setViewAssignment(null);
    setFormError(null);
  }

  async function saveAssignment(values: RouteAssignmentFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingAssignment) {
        const nextAssignment = await updateMutation.mutateAsync({
          recordId: editingAssignment.id,
          values,
        });
        notifyUpdated("Route", formatRouteAssignmentName(nextAssignment));
      } else {
        const nextAssignment = await createMutation.mutateAsync(values);
        notifyAdded("Route", formatRouteAssignmentName(nextAssignment));
      }

      setFormMode(null);
      setEditingAssignment(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
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

  const stats = [
    {
      label: "Total assignments",
      value: kpis.isLoading ? "…" : kpis.total.toString(),
      description: "Scheduled today",
      icon: ClipboardList,
    },
    {
      label: "Vehicles assigned",
      value: kpis.isLoading ? "…" : kpis.uniqueVehicles.toString(),
      description: "Distinct vehicles today",
      icon: Car,
    },
    {
      label: "Employee groups",
      value: kpis.isLoading ? "…" : kpis.uniqueGroups.toString(),
      description: "Distinct groups today",
      icon: UsersRound,
    },
  ];

  const tableColumns: DataTableColumn<RouteAssignment>[] = [
    {
      id: "date",
      label: "date",
      renderCell: (assignment) => (
        <div className="flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
          {formatRouteAssignmentDate(assignment.date)}
        </div>
      ),
    },
    {
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (assignment) => formatRouteAssignmentName(assignment),
    },
    {
      id: "employeeGroup.name",
      label: "employeeGroup.name",
      renderCell: (assignment) => assignment.employeeGroup.name || "—",
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

  const columnVisibility = useColumnVisibility("route-assignments-v2", tableColumns);
  const hasActiveFilters = Boolean(filters.query.trim());
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    isSearchPending,
    matched: totalAssignments,
    noun: "assignments",
    isLoading: isFetching && assignments.length === 0,
  });

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
            setDeleteTarget(assignments.filter((assignment) => selectedIds.includes(assignment.id)))
          }
        />

        {isError ? (
          <div className="px-6 py-8 text-sm text-destructive">{normalizeApiError(error).message}</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={assignments}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(assignment) => assignment.id}
            rowLabel={(assignment) => formatRouteAssignmentName(assignment)}
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

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
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

      <RouteAssignmentViewSheet
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
            <DialogTitle>{formMode === "edit" ? "Edit route" : "Add route"}</DialogTitle>
          </DialogHeader>
          <RouteAssignmentForm
            key={editingAssignment?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingAssignment
                ? routeAssignmentToFormValues(editingAssignment)
                : createEmptyRouteAssignmentForm()
            }
            copySources={formMode === "add" ? assignments : []}
            isEditing={formMode === "edit"}
            submitLabel={formMode === "edit" ? "Save changes" : "Add route"}
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
