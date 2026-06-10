"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";

import { BranchForm } from "@/components/branches/branch-form";
import { BranchViewSheet } from "@/components/branches/branch-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";
import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
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
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
  TableFilterSection,
} from "@/components/app-shell/table-directory-toolbar";
import { normalizeApiError } from "@/lib/api/axios";
import { formatPhoneDisplayOrDash } from "@/lib/utils/phone";
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
  type: "all",
};

export function BranchesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<BranchFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [viewBranch, setViewBranch] = useState<Branch | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | Branch[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(() => {
    const search = createBranchSearchFilter(deferredQuery);

    return {
      ...DEFAULT_BRANCH_LIST_PARAMS,
      page,
      limit: PAGE_SIZE,
      search,
      type: filters.type,
    };
  }, [deferredQuery, filters.type, page]);

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
      label: "Branch ID",
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
      renderCell: (branch) => formatPhoneDisplayOrDash(branch.phone1),
    },
    {
      id: "phone2",
      label: "phone2",
      renderCell: (branch) => formatPhoneDisplayOrDash(branch.phone2),
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
  ];

  const columnVisibility = useColumnVisibility("branches", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const hasTypeFilters = typeFilters.length > 1;
  const activeFilterCount = filters.type !== "all" ? 1 : 0;
  const hasActiveFilters = Boolean(filters.query.trim()) || filters.type !== "all";

  return (
    <div>
      <PageHeader
        title="Branches"
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add branch
          </Button>
        }
      />

      <StatCardsGrid>
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
      </StatCardsGrid>

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            showFilterToggle={hasTypeFilters}
            columnLayout={columnVisibility}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters((current) => ({ ...current, query }));
                  setPage(1);
                }}
                placeholder="Search branches..."
              />
            }
            filterPanel={
              hasTypeFilters ? (
                <TableFilterPanel
                  resultSummary={`Showing ${branches.length} of ${totalBranches} branches`}
                  onClearAll={
                    hasActiveFilters
                      ? () => {
                          setFilters(defaultFilters);
                          setPage(1);
                        }
                      : undefined
                  }
                >
                  <TableFilterSection label="Type">
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
                  </TableFilterSection>
                </TableFilterPanel>
              ) : undefined
            }
          />
        </CardHeader>

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : null}

        <TableSelectionBar
          selectedIds={selectedIds.map(String)}
          pageRowIds={branches.map((branch) => String(branch.id))}
          onSelectedIdsChange={(ids) => setSelectedIds(ids.map(Number))}
          onEdit={() => {
            const branch = branches.find((entry) => entry.id === selectedIds[0]);
            if (branch) openEditForm(branch);
          }}
          onDelete={() => setDeleteTarget(branches.filter((branch) => selectedIds.includes(branch.id)))}
          deleteDisabled={isSaving}
        />

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading branches…</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={branches}
            page={currentPage}
            isPageDataPending={isFetching}
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
            onRowDoubleClick={openEditForm}
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
