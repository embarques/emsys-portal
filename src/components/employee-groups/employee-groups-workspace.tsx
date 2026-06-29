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

import { EmployeeGroupFormDialog } from "@/components/employee-groups/employee-group-form-dialog";
import { EmployeeGroupViewSheet } from "@/components/employee-groups/employee-group-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
  TableFilterSection,
} from "@/components/app-shell/table-directory-toolbar";
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
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDateTime } from "@/lib/audit/display";
import type { EmployeeGroupOption } from "@/lib/employee-groups/api/employee-groups-api";
import {
  formatEmployeeMemberNames,
  getEmployeeGroupBranchBadgeClass,
  getEmployeeGroupBranchLabel,
} from "@/lib/employee-groups/display";
import {
  useEmployeeGroups,
  useDeleteEmployeeGroups,
} from "@/lib/employee-groups/hooks/use-employee-groups";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { getVehiclePortalBranch } from "@/lib/vehicles/types";

const PAGE_SIZE = 50;

type BranchFilter = "all" | "usa" | "dr";

type EmployeeGroupFilterState = {
  query: string;
  branch: BranchFilter;
};

const defaultFilters: EmployeeGroupFilterState = {
  query: "",
  branch: "all",
};

const branchFilters: { value: BranchFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

function groupMatchesQuery(group: EmployeeGroupOption, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    group.name,
    group.createdBy,
    getEmployeeGroupBranchLabel(group.branch ?? ""),
    group.employees.map((employee) => employee.name).join(" "),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function EmployeeGroupsWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const { data, isLoading, isError, error, isFetching } = useEmployeeGroups(200);
  const deleteGroupsMutation = useDeleteEmployeeGroups();
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const [filters, setFilters] = useState<EmployeeGroupFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewGroup, setViewGroup] = useState<EmployeeGroupOption | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<EmployeeGroupOption | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeGroupOption | EmployeeGroupOption[] | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isDeleting = deleteGroupsMutation.isPending;

  const groups = useMemo(() => data?.items ?? [], [data?.items]);

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      if (!groupMatchesQuery(group, filters.query)) return false;
      if (filters.branch !== "all" && getVehiclePortalBranch(group.branch ?? "") !== filters.branch) {
        return false;
      }
      return true;
    });
  }, [filters, groups]);

  const kpis = useMemo(() => {
    let usa = 0;
    let dr = 0;
    for (const group of groups) {
      if (getVehiclePortalBranch(group.branch ?? "") === "dr") dr += 1;
      else usa += 1;
    }
    return { total: groups.length, usa, dr };
  }, [groups]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageGroups = filteredGroups.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected =
    pageGroups.length > 0 && pageGroups.every((group) => selectedIds.includes(group.id));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...pageGroups.map((group) => group.id)]))
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !pageGroups.some((group) => group.id === id))
    );
  }

  function toggleSelect(groupId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, groupId] : current.filter((entry) => entry !== groupId)));
  }

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({
        feature: "employee-groups",
        baseHref: "/employee-groups",
        mode: "add",
        label: "Create employee group",
      });
      return;
    }
    setCreateOpen(true);
  }

  function openEditForm(group: EmployeeGroupOption) {
    if (isDesktopTabs) {
      openFormTab({
        feature: "employee-groups",
        baseHref: "/employee-groups",
        mode: "edit",
        entityId: group.id,
        label: `Edit ${group.name}`,
      });
      return;
    }
    setEditGroup(group);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const targets = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget];
    const ids = targets.map((group) => group.id);

    try {
      await deleteGroupsMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewGroup(null);
      setDeleteError(null);
      notifyDeleted("Employee group", ids.length);
    } catch (mutationError) {
      setDeleteError(normalizeApiError(mutationError).message);
    }
  }

  const stats = [
    { label: "Total groups", value: isLoading ? "…" : kpis.total.toString(), description: "Employee groups on record", icon: UsersRound },
    { label: "USA", value: isLoading ? "…" : kpis.usa.toString(), description: "United States branch", icon: MapPin },
    { label: "DR", value: isLoading ? "…" : kpis.dr.toString(), description: "Dominican Republic branch", icon: MapPin },
  ];

  const tableColumns: DataTableColumn<EmployeeGroupOption>[] = [
    {
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (group) => group.name,
    },
    {
      id: "employees",
      label: "employees",
      truncateCell: false,
      cellClassName: "whitespace-normal",
      renderCell: (group) => formatEmployeeMemberNames(group.employees),
    },
    {
      id: "count",
      label: "count",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (group) => <TableTagText>{group.employees.length}</TableTagText>,
    },
    {
      id: "branch",
      label: "branch",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (group) =>
        group.branch ? (
          <TableTagText className={getEmployeeGroupBranchBadgeClass(group.branch)}>
            {getEmployeeGroupBranchLabel(group.branch)}
          </TableTagText>
        ) : (
          "—"
        ),
    },
    {
      id: "createdAt",
      label: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (group) => (group.createdAt ? formatAuditDateTime(group.createdAt) : "—"),
    },
    {
      id: "createdBy",
      label: "createdBy",
      cellClassName: "text-muted-foreground",
      renderCell: (group) => group.createdBy || "—",
    },
    {
      id: "updatedAt",
      label: "updatedAt",
      cellClassName: "text-muted-foreground",
      renderCell: (group) => (group.updatedAt ? formatAuditDateTime(group.updatedAt) : "—"),
    },
  ];

  const columnVisibility = useColumnVisibility("employee-groups-v2", tableColumns);
  const activeFilterCount = filters.branch !== "all" ? 1 : 0;
  const hasActiveFilters = Boolean(filters.query.trim()) || filters.branch !== "all";
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    matched: filteredGroups.length,
    catalogTotal: groups.length,
    noun: "groups",
    isLoading: isFetching && groups.length === 0,
  });

  return (
    <div>
      <PageHeader
        title="Employee Groups"
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add group
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

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={pageGroups.map((group) => group.id)}
          totalCount={filteredGroups.length}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const group = groups.find((entry) => entry.id === selectedIds[0]);
            if (group) openEditForm(group);
          }}
          onDelete={() => {
            setDeleteError(null);
            setDeleteTarget(groups.filter((group) => selectedIds.includes(group.id)));
          }}
        />

        {isError ? (
          <div className="px-6 py-8 text-sm text-destructive">{normalizeApiError(error).message}</div>
        ) : isLoading ? (
          <DirectoryTableLoader
            icon={UsersRound}
            title="Loading employee groups"
            description="Syncing crews and their members…"
            columns={["Name", "Employees", "Count", "Branch", "Created"]}
          />
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageGroups}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(group) => group.id}
            rowLabel={(group) => group.name}
            columnLayout={columnVisibility}
            sortUnavailable
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
        )}

        {!isLoading && !isError ? (
          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {isFetching
                ? "Refreshing employee groups…"
                : `Showing ${pageGroups.length} of ${filteredGroups.length} groups`}
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

      <EmployeeGroupViewSheet
        group={viewGroup}
        open={Boolean(viewGroup)}
        onOpenChange={(open) => {
          if (!open) setViewGroup(null);
        }}
        onEdit={(group) => {
          setViewGroup(null);
          openEditForm(group);
        }}
        onDelete={(group) => {
          setViewGroup(null);
          setDeleteError(null);
          setDeleteTarget(group);
        }}
      />

      <EmployeeGroupFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(group) => notifyAdded("Employee group", group.name)}
      />

      <EmployeeGroupFormDialog
        open={editGroup !== null}
        group={editGroup}
        onOpenChange={(open) => {
          if (!open) setEditGroup(null);
        }}
        onUpdated={(group) => {
          notifyUpdated("Employee group", group.name);
          setEditGroup(null);
        }}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              Delete employee group{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected employee groups. This action cannot be undone.`
                : `This will permanently remove ${deleteTarget?.name ?? "this employee group"}. This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteError(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
