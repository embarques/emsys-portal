"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  Trash2,
  UsersRound,
} from "lucide-react";

import { EmployeeGroupForm } from "@/components/employee-groups/employee-group-form";
import { EmployeeGroupViewSheet } from "@/components/employee-groups/employee-group-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
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
  computeEmployeeGroupKpis,
  employeeGroupMatchesQuery,
  formatEmployeeGroupDate,
  formatEmployeeGroupMembersSummary,
  getEmployeeGroupBranchBadgeClass,
  getEmployeeGroupBranchLabel,
  truncateEmployeeGroupId,
} from "@/lib/employee-groups/display";
import { cloneEmployeeGroups } from "@/lib/employee-groups/mock-data";
import {
  createEmptyEmployeeGroupForm,
  EMPLOYEE_GROUP_BRANCHES,
  employeeGroupToFormValues,
  formValuesToEmployeeGroup,
  type EmployeeGroup,
  type EmployeeGroupFilterState,
  type EmployeeGroupFormValues,
} from "@/lib/employee-groups/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 8;

const defaultFilters: EmployeeGroupFilterState = {
  query: "",
  branch: "all",
};

export function EmployeeGroupsWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [groups, setGroups] = useState<EmployeeGroup[]>(() => cloneEmployeeGroups());
  const [filters, setFilters] = useState<EmployeeGroupFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewGroup, setViewGroup] = useState<EmployeeGroup | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingGroup, setEditingGroup] = useState<EmployeeGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeGroup | EmployeeGroup[] | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      if (!employeeGroupMatchesQuery(group, filters.query)) return false;
      if (filters.branch !== "all" && group.branch !== filters.branch) return false;
      return true;
    });
  }, [filters, groups]);

  const kpis = useMemo(() => computeEmployeeGroupKpis(groups), [groups]);
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageGroups = filteredGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected =
    pageGroups.length > 0 && pageGroups.every((group) => selectedIds.includes(group.employeeGroupId));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...pageGroups.map((group) => group.employeeGroupId)]))
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !pageGroups.some((group) => group.employeeGroupId === id))
    );
  }

  function toggleSelect(groupId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, groupId] : current.filter((entry) => entry !== groupId)));
  }

  function openAddForm() {
    setEditingGroup(null);
    setFormMode("add");
  }

  function openEditForm(group: EmployeeGroup) {
    setEditingGroup(group);
    setFormMode("edit");
    setViewGroup(null);
  }

  function saveGroup(values: EmployeeGroupFormValues) {
    if (formMode === "edit" && editingGroup) {
      const nextGroup = formValuesToEmployeeGroup(
        { ...values, createdBy: editingGroup.createdBy },
        editingGroup.createdAt,
        new Date().toISOString()
      );
      setGroups((current) =>
        current.map((group) => (group.employeeGroupId === editingGroup.employeeGroupId ? nextGroup : group))
      );
      notifyUpdated("Employee group");
    } else {
      setGroups((current) => [formValuesToEmployeeGroup(values), ...current]);
      notifyAdded("Employee group");
    }

    setFormMode(null);
    setEditingGroup(null);
    setPage(1);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((group) => group.employeeGroupId)
      : [deleteTarget.employeeGroupId];
    setGroups((current) => current.filter((group) => !ids.includes(group.employeeGroupId)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewGroup(null);
    notifyDeleted("Employee group", ids.length);
  }

  const stats = [
    { label: "Total groups", value: kpis.total.toString(), description: "Employee groups on record", icon: UsersRound },
    { label: "USA", value: kpis.usa.toString(), description: "United States branch", icon: MapPin },
    { label: "DR", value: kpis.dr.toString(), description: "Dominican Republic branch", icon: MapPin },
  ];

  const branchFilters: { value: EmployeeGroupFilterState["branch"]; label: string }[] = [
    { value: "all", label: "All" },
    ...EMPLOYEE_GROUP_BRANCHES,
  ];

  const tableColumns: DataTableColumn<EmployeeGroup>[] = [
    {
      id: "groupId",
      label: "Group ID",
      cellClassName: "font-mono text-xs",
      renderCell: (group) => truncateEmployeeGroupId(group.employeeGroupId),
    },
    {
      id: "employees",
      label: "Employees",
      renderCell: (group) => formatEmployeeGroupMembersSummary(group),
    },
    {
      id: "count",
      label: "Count",
      renderCell: (group) => <Badge variant="outline">{group.employeeIds.length}</Badge>,
    },
    {
      id: "branch",
      label: "Branch",
      renderCell: (group) => (
        <Badge className={getEmployeeGroupBranchBadgeClass(group.branch)}>
          {getEmployeeGroupBranchLabel(group.branch)}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (group) => formatEmployeeGroupDate(group.createdAt),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (group) => group.createdBy,
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (group) => formatAuditDate(group.updatedAt),
    },
  ];

  const columnVisibility = useColumnVisibility("employee-groups", tableColumns);
  const activeFilterCount = filters.branch !== "all" ? 1 : 0;
  const hasActiveFilters = Boolean(filters.query.trim()) || filters.branch !== "all";

  return (
    <div>
      <PageHeader
        title="Employee Groups"
        description="Organize employees into groups by branch with created-by audit details."
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add group
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
          <CardTitle>Group directory</CardTitle>

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
                placeholder="Search employee groups..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${filteredGroups.length} of ${groups.length} groups`}
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
              </TableFilterPanel>
            }
          />
        </CardHeader>

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={pageGroups.map((group) => group.employeeGroupId)}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const group = pageGroups.find((entry) => entry.employeeGroupId === selectedIds[0]);
            if (group) openEditForm(group);
          }}
          onDelete={() =>
            setDeleteTarget(groups.filter((group) => selectedIds.includes(group.employeeGroupId)))
          }
        />

        <DataTable
          columns={columnVisibility.columns}
          rows={pageGroups}
          page={currentPage}
          rowKey={(group) => group.employeeGroupId}
          rowLabel={(group) => group.employeeGroupId}
          columnLayout={columnVisibility}
          minWidth={960}
          selectable
          selectedIds={selectedIds}
          allPageSelected={allPageSelected}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelect}
          onRowClick={setViewGroup}
          onRowDoubleClick={openEditForm}
          emptyState={
            <>
              <p className="text-muted-foreground">No employee groups match your search.</p>
              <Button className="mt-4" onClick={openAddForm}>
                <Plus className="h-4 w-4" />
                Add group
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageGroups.length} of {filteredGroups.length} groups
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

      <EmployeeGroupViewSheet
        group={viewGroup}
        open={Boolean(viewGroup)}
        onOpenChange={(open) => {
          if (!open) setViewGroup(null);
        }}
        onEdit={openEditForm}
        onDelete={(group) => {
          setViewGroup(null);
          setDeleteTarget(group);
        }}
      />

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit employee group" : "Add employee group"}</DialogTitle>
            <DialogDescription>
              {formMode === "edit"
                ? "Update the employees assigned to this group."
                : "Create a new employee group with a generated group ID."}
            </DialogDescription>
          </DialogHeader>
          <EmployeeGroupForm
            key={editingGroup?.employeeGroupId ?? "new"}
            initialValues={
              formMode === "edit" && editingGroup
                ? employeeGroupToFormValues(editingGroup)
                : createEmptyEmployeeGroupForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingGroup?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add group"}
            onSubmit={saveGroup}
            onCancel={() => setFormMode(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              Delete employee group{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected groups. This action cannot be undone.`
                : "This will permanently remove this employee group. This action cannot be undone."}
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
