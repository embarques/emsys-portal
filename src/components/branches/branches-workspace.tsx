"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { BranchForm } from "@/components/branches/branch-form";
import { BranchViewSheet } from "@/components/branches/branch-view-sheet";
import { ColumnVisibilityMenu } from "@/components/app-shell/column-visibility-menu";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
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
import { Input } from "@/components/ui/input";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDate } from "@/lib/audit/display";
import {
  formatBranchAddress,
  formatBranchId,
  formatBranchPhones,
  getBranchTypeBadgeClass,
} from "@/lib/branches/display";
import {
  useBranchStats,
  useBranches,
  useCreateBranch,
  useDeleteBranches,
  useUpdateBranch,
} from "@/lib/branches/hooks/use-branches";
import {
  BRANCH_SEARCH_FIELDS,
  BRANCH_SEARCH_OPERATORS,
  DEFAULT_BRANCH_LIST_PARAMS,
  branchToFormValues,
  createBranchSearchFilter,
  createEmptyBranchForm,
  type Branch,
  type BranchFilterState,
  type BranchFormValues,
} from "@/lib/branches/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = DEFAULT_BRANCH_LIST_PARAMS.limit;

const defaultFilters: BranchFilterState = {
  query: "",
  searchField: "name",
  searchOperator: "startsWith",
  type: "all",
};

export function BranchesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<BranchFilterState>(defaultFilters);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [viewBranch, setViewBranch] = useState<Branch | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | Branch[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(() => {
    const search = createBranchSearchFilter(deferredQuery, filters.searchField, filters.searchOperator);

    return {
      ...DEFAULT_BRANCH_LIST_PARAMS,
      page,
      limit: PAGE_SIZE,
      search,
      type: filters.type,
    };
  }, [deferredQuery, filters.searchField, filters.searchOperator, filters.type, page]);

  const { data, isLoading, isError, error, isFetching } = useBranches(listParams);
  const stats = useBranchStats();
  const createBranchMutation = useCreateBranch();
  const updateBranchMutation = useUpdateBranch();
  const deleteBranchesMutation = useDeleteBranches();

  const branches = data?.items ?? [];
  const totalBranches = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalBranches / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    branches.length > 0 && branches.every((branch) => selectedIds.includes(branch.id));
  const isSaving =
    createBranchMutation.isPending ||
    updateBranchMutation.isPending ||
    deleteBranchesMutation.isPending;

  const typeFilters = useMemo(() => {
    const discovered = new Set<string>();
    for (const branch of branches) {
      if (branch.type.trim()) discovered.add(branch.type.trim());
    }

    return [
      { value: "all", label: "All types" },
      ...Array.from(discovered)
        .sort((a, b) => a.localeCompare(b))
        .map((type) => ({ value: type, label: type })),
    ];
  }, [branches]);

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...branches.map((branch) => branch.id)])));
      return;
    }
    setSelectedIds((current) => current.filter((id) => !branches.some((branch) => branch.id === id)));
  }

  function toggleSelect(branchId: number, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, branchId] : current.filter((entry) => entry !== branchId),
    );
  }

  function openAddForm() {
    setEditingBranch(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(branch: Branch) {
    setEditingBranch(branch);
    setFormMode("edit");
    setViewBranch(null);
    setFormError(null);
  }

  async function saveBranch(values: BranchFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingBranch) {
        const nextBranch = await updateBranchMutation.mutateAsync({
          branchId: editingBranch.id,
          values,
        });
        notifyUpdated("Branch", nextBranch.name);
      } else {
        const nextBranch = await createBranchMutation.mutateAsync(values);
        notifyAdded("Branch", nextBranch.name);
      }

      setFormMode(null);
      setEditingBranch(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((branch) => branch.id)
      : [deleteTarget.id];

    try {
      await deleteBranchesMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewBranch(null);
      notifyDeleted("Branch", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const tableColumns: DataTableColumn<Branch>[] = [
    {
      id: "id",
      label: "id",
      cellClassName: "font-mono text-xs",
      renderCell: (branch) => formatBranchId(branch.id),
    },
    {
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (branch) => branch.name,
    },
    {
      id: "code",
      label: "code",
      renderCell: (branch) => branch.code || "—",
    },
    {
      id: "type",
      label: "type",
      renderCell: (branch) =>
        branch.type ? (
          <Badge className={getBranchTypeBadgeClass(branch.type)}>{branch.type}</Badge>
        ) : (
          "—"
        ),
    },
    {
      id: "phone1",
      label: "phone1",
      renderCell: (branch) => branch.phone1 || "—",
    },
    {
      id: "phone2",
      label: "phone2",
      renderCell: (branch) => branch.phone2 || "—",
    },
    {
      id: "phones",
      label: "phones",
      renderCell: (branch) => formatBranchPhones(branch),
    },
    {
      id: "address.city",
      label: "address.city",
      renderCell: (branch) => branch.address.city || "—",
    },
    {
      id: "address.state",
      label: "address.state",
      renderCell: (branch) => branch.address.state || "—",
    },
    {
      id: "address.country",
      label: "address.country",
      renderCell: (branch) => branch.address.country || "—",
    },
    {
      id: "address",
      label: "address",
      renderCell: (branch) => formatBranchAddress(branch),
    },
    {
      id: "settings.labelPrefix",
      label: "settings.labelPrefix",
      renderCell: (branch) => branch.settings.labelPrefix || "—",
    },
    {
      id: "created",
      label: "created",
      cellClassName: "text-muted-foreground",
      renderCell: (branch) => (branch.created ? formatAuditDate(branch.created) : "—"),
    },
    {
      id: "actions",
      label: "Actions",
      hideable: false,
      stopRowClick: true,
      renderCell: (branch) => (
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => openEditForm(branch)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              setViewBranch(null);
              setDeleteTarget(branch);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("branches", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Manage core.Branch records with address, settings, and contact details from the EMSYS API."
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add branch
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total branches</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.isLoading ? "…" : stats.total.toString()}</div>
            <CardDescription className="mt-1">Branches on record</CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Branch directory</CardTitle>
              <CardDescription>
                Server-backed list from GET /branches with pagination, sorting, and API search filters.
              </CardDescription>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:max-w-3xl lg:justify-end">
              <select
                aria-label="Search field"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={filters.searchField}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    searchField: event.target.value as BranchFilterState["searchField"],
                  }));
                  setPage(1);
                }}
              >
                {BRANCH_SEARCH_FIELDS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Search operator"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={filters.searchOperator}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    searchOperator: event.target.value as BranchFilterState["searchOperator"],
                  }));
                  setPage(1);
                }}
              >
                {BRANCH_SEARCH_OPERATORS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.query}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, query: event.target.value }));
                    setPage(1);
                  }}
                  className="pl-9"
                  placeholder="Search branches..."
                />
              </div>
              <ColumnVisibilityMenu columnLayout={columnVisibility} />
            </div>
          </div>

          {typeFilters.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</span>
              {typeFilters.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={filters.type === option.value ? "default" : "outline"}
                  onClick={() => {
                    setFilters((current) => ({ ...current, type: option.value }));
                    setPage(1);
                  }}
                >
                  {option.label}
                </Button>
              ))}
              {filters.query || filters.type !== "all" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFilters(defaultFilters);
                    setPage(1);
                  }}
                >
                  Clear search & filters
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardHeader>

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : null}

        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-3 border-b bg-muted/30 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">{selectedIds.length} selected</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                Clear selection
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isSaving}
                onClick={() =>
                  setDeleteTarget(branches.filter((branch) => selectedIds.includes(branch.id)))
                }
              >
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading branches…</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={branches}
            rowKey={(branch) => String(branch.id)}
            rowLabel={(branch) => branch.name}
            columnLayout={columnVisibility}
            minWidth={1400}
            selectable
            selectedIds={selectedIds.map(String)}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={(id, checked) => toggleSelect(Number(id), checked)}
            onRowClick={setViewBranch}
            emptyState={
              <>
                <p className="text-muted-foreground">No branches match your search or filters.</p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add branch
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {isFetching
              ? "Refreshing branches…"
              : `Showing ${branches.length} of ${totalBranches} branches`}
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

      <BranchViewSheet
        branch={viewBranch}
        open={Boolean(viewBranch)}
        onOpenChange={(open) => {
          if (!open) setViewBranch(null);
        }}
        onEdit={openEditForm}
        onDelete={(branch) => {
          setViewBranch(null);
          setDeleteTarget(branch);
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit branch" : "Add branch"}</DialogTitle>
            <DialogDescription>
              Fields match the EMSYS core.Branch API model: address, code, disclaimer, logo, name, phone1,
              phone2, settings, and type.
            </DialogDescription>
          </DialogHeader>
          <BranchForm
            key={editingBranch?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingBranch
                ? branchToFormValues(editingBranch)
                : createEmptyBranchForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={formMode === "edit" ? "Save changes" : "Add branch"}
            isSubmitting={isSaving}
            onSubmit={saveBranch}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              Delete branch{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "es" : ""}?
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected branches.`
                : "This will permanently remove this branch. This action cannot be undone."}
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
