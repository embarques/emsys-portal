"use client";

import { useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Plus,
  Trash2,
  Truck,
  UsersRound,
} from "lucide-react";

import { RouteAssignmentForm } from "@/components/route-assignments/route-assignment-form";
import { RouteAssignmentViewSheet } from "@/components/route-assignments/route-assignment-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
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
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeRouteAssignmentKpis,
  formatRouteAssignmentDate,
  formatRouteAssignmentTimestamp,
  getEmployeeGroupRefLabel,
  getTruckRefLabel,
  routeAssignmentMatchesSearch,
  truncateObjectId,
  truncateRouteAssignmentId,
} from "@/lib/route-assignments/display";
import { cloneRouteAssignments } from "@/lib/route-assignments/mock-data";
import {
  createEmptyRouteAssignmentForm,
  createRouteAssignmentSearchFilter,
  formValuesToRouteAssignment,
  routeAssignmentToFormValues,
  type RouteAssignment,
  type RouteAssignmentFilterState,
  type RouteAssignmentFormValues,
} from "@/lib/route-assignments/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 8;

const defaultFilters: RouteAssignmentFilterState = {
  query: "",
};

export function RouteAssignmentsWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [assignments, setAssignments] = useState<RouteAssignment[]>(() => cloneRouteAssignments());
  const [filters, setFilters] = useState<RouteAssignmentFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewAssignment, setViewAssignment] = useState<RouteAssignment | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<RouteAssignment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RouteAssignment | RouteAssignment[] | null>(null);

  const filteredAssignments = useMemo(() => {
    const search = createRouteAssignmentSearchFilter(filters.query);

    return assignments.filter((assignment) => {
      if (search && !routeAssignmentMatchesSearch(assignment, search)) return false;
      return true;
    });
  }, [assignments, filters.query]);

  const kpis = useMemo(() => computeRouteAssignmentKpis(assignments), [assignments]);
  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageAssignments = filteredAssignments.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected =
    pageAssignments.length > 0 && pageAssignments.every((assignment) => selectedIds.includes(assignment.id));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...pageAssignments.map((assignment) => assignment.id)])),
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !pageAssignments.some((assignment) => assignment.id === id)),
    );
  }

  function toggleSelect(assignmentId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, assignmentId] : current.filter((entry) => entry !== assignmentId),
    );
  }

  function openAddForm() {
    setEditingAssignment(null);
    setFormMode("add");
  }

  function openEditForm(assignment: RouteAssignment) {
    setEditingAssignment(assignment);
    setFormMode("edit");
    setViewAssignment(null);
  }

  function saveAssignment(values: RouteAssignmentFormValues) {
    if (formMode === "edit" && editingAssignment) {
      const nextAssignment = formValuesToRouteAssignment(
        { ...values, createdBy: editingAssignment.createdBy },
        editingAssignment.createdAt,
        new Date().toISOString(),
        editingAssignment.id,
      );
      setAssignments((current) =>
        current.map((assignment) => (assignment.id === editingAssignment.id ? nextAssignment : assignment)),
      );
      notifyUpdated("Route assignment", nextAssignment.name);
    } else {
      const nextAssignment = formValuesToRouteAssignment(values);
      setAssignments((current) => [nextAssignment, ...current]);
      notifyAdded("Route assignment", nextAssignment.name);
    }

    setFormMode(null);
    setEditingAssignment(null);
    setPage(1);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((assignment) => assignment.id)
      : [deleteTarget.id];
    setAssignments((current) => current.filter((assignment) => !ids.includes(assignment.id)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewAssignment(null);
    notifyDeleted("Route assignment", ids.length);
  }

  const stats = [
    {
      label: "Total assignments",
      value: kpis.total.toString(),
      description: "Scheduled route assignments",
      icon: ClipboardList,
    },
    {
      label: "Trucks assigned",
      value: kpis.uniqueTrucks.toString(),
      description: "Distinct trucks in use",
      icon: Truck,
    },
    {
      label: "Employee groups",
      value: kpis.uniqueGroups.toString(),
      description: "Distinct groups scheduled",
      icon: UsersRound,
    },
  ];

  const tableColumns: DataTableColumn<RouteAssignment>[] = [
    {
      id: "id",
      label: "Assignment ID",
      cellClassName: "font-mono text-xs",
      renderCell: (assignment) => truncateObjectId(assignment.id),
    },
    {
      id: "routeAssignmentId",
      label: "routeAssignmentId",
      cellClassName: "font-mono text-xs",
      renderCell: (assignment) => truncateRouteAssignmentId(assignment.routeAssignmentId),
    },
    {
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (assignment) => assignment.name,
    },
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
      id: "truck.id",
      label: "truck.id",
      cellClassName: "font-mono text-xs",
      renderCell: (assignment) => assignment.truck.id || "—",
    },
    {
      id: "truck.name",
      label: "truck.name",
      renderCell: (assignment) => assignment.truck.name || "—",
    },
    {
      id: "truck",
      label: "truck",
      renderCell: (assignment) => getTruckRefLabel(assignment.truck),
    },
    {
      id: "employeeGroup.id",
      label: "employeeGroup.id",
      cellClassName: "font-mono text-xs",
      renderCell: (assignment) => assignment.employeeGroup.id || "—",
    },
    {
      id: "employeeGroup.name",
      label: "employeeGroup.name",
      renderCell: (assignment) => assignment.employeeGroup.name || "—",
    },
    {
      id: "employeeGroup",
      label: "employeeGroup",
      renderCell: (assignment) => getEmployeeGroupRefLabel(assignment.employeeGroup),
    },
    {
      id: "createdAt",
      label: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (assignment) =>
        assignment.createdAt ? formatRouteAssignmentTimestamp(assignment.createdAt) : "—",
    },
    {
      id: "createdBy",
      label: "createdBy",
      renderCell: (assignment) => assignment.createdBy || "—",
    },
    {
      id: "updatedAt",
      label: "updatedAt",
      cellClassName: "text-muted-foreground",
      renderCell: (assignment) => (assignment.updatedAt ? formatAuditDate(assignment.updatedAt) : "—"),
    },
  ];

  const columnVisibility = useColumnVisibility("route-assignments", tableColumns);

  return (
    <div>
      <PageHeader
        title="Route Assignments"
        description="Assign trucks and employee groups to routes by date."
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add assignment
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
          <CardTitle>Assignment directory</CardTitle>

          <TableDirectoryToolbar
            showFilterToggle={false}
            columnLayout={columnVisibility}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters((current) => ({ ...current, query }));
                  setPage(1);
                }}
                placeholder="Search route assignments..."
              />
            }
          />
        </CardHeader>

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={pageAssignments.map((assignment) => assignment.id)}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const assignment = pageAssignments.find((entry) => entry.id === selectedIds[0]);
            if (assignment) openEditForm(assignment);
          }}
          onDelete={() =>
            setDeleteTarget(assignments.filter((assignment) => selectedIds.includes(assignment.id)))
          }
        />

        <DataTable
          columns={columnVisibility.columns}
          rows={pageAssignments}
          page={currentPage}
          rowKey={(assignment) => assignment.id}
          rowLabel={(assignment) => assignment.name}
          columnLayout={columnVisibility}
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
              <p className="text-muted-foreground">No route assignments match your search.</p>
              <Button className="mt-4" onClick={openAddForm}>
                <Plus className="h-4 w-4" />
                Add assignment
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageAssignments.length} of {filteredAssignments.length} assignments
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

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit route assignment" : "Add route assignment"}</DialogTitle>
            <DialogDescription>
              Fields match the EMSYS Route Assignment API model: id, routeAssignmentId, name, date, truck, and
              employeeGroup.
            </DialogDescription>
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
            submitLabel={formMode === "edit" ? "Save changes" : "Add assignment"}
            onSubmit={saveAssignment}
            onCancel={() => setFormMode(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              Delete route assignment{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected assignments. This action cannot be undone.`
                : `This will permanently remove ${deleteTarget?.name ?? "this assignment"}. This action cannot be undone.`}
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
