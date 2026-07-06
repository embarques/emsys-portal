"use client";

import { useMemo, useState } from "react";
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
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";
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
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { BRANCH_TABLE_FILTER_FIELDS } from "@/lib/branches/filter-fields";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { formatPhoneDisplayOrDash } from "@/lib/utils/phone";
import { formatAuditDateTime } from "@/lib/audit/display";
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
  buildBranchListParams,
  branchToFormValues,
  createEmptyBranchForm,
  type Branch,
  type BranchFilterState,
  type BranchFormValues,
} from "@/lib/branches/types";
import type { DataTableColumn } from "@/lib/table/types";
import { useTableSort } from "@/lib/table/use-table-sort";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";

const PAGE_SIZE = DEFAULT_BRANCH_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: BranchFilterState = {
  query: "",
  rows: [],
};

export function BranchesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<BranchFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_BRANCH_LIST_PARAMS.sort, () => setPage(1));
  const [viewBranch, setViewBranch] = useState<Branch | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | Branch[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () =>
      buildBranchListParams({
        page,
        limit: PAGE_SIZE,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useBranches(listParams);
  const stats = useBranchStats();
  const createBranchMutation = useCreateBranch();
  const updateBranchMutation = useUpdateBranch();
  const deleteBranchesMutation = useDeleteBranches();

  const branches = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const totalBranches = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalBranches / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const allPageSelected =
    branches.length > 0 && branches.every((branch) => selectedIds.includes(branch.id));
  const isSaving =
    createBranchMutation.isPending ||
    updateBranchMutation.isPending ||
    deleteBranchesMutation.isPending;

  useTableSelectionReset<number>(
    buildTableSelectionResetKey(debouncedQuery, filters.rows),
    setSelectedIds,
  );

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

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({ feature: "branches", baseHref: "/branches", mode: "add", label: "Add branch" });
      return;
    }
    setEditingBranch(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(branch: Branch) {
    if (isDesktopTabs) {
      setViewBranch(null);
      openFormTab({
        feature: "branches",
        baseHref: "/branches",
        mode: "edit",
        entityId: String(branch.id),
        label: `Edit ${branch.name}`,
      });
      return;
    }
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
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (branch) =>
        branch.type ? (
          <TableTagText className={getBranchTypeBadgeClass(branch.type)}>
            {branch.type}
          </TableTagText>
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
      sortField: "phone1",
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
      sortField: "address.address1",
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
      renderCell: (branch) => (branch.created ? formatAuditDateTime(branch.created) : "—"),
    },
  ];

  const columnVisibility = useColumnVisibility("branches", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const activeFilterCount = countCompleteFilterRows(filters.rows, BRANCH_TABLE_FILTER_FIELDS);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    isSearchPending,
    matched: totalBranches,
    catalogTotal: stats.total,
    noun: "branches",
    isLoading: isFetching && branches.length === 0,
    catalogLoading: stats.isLoading,
  });

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

      <StatCards
        items={[
          {
            label: "Total branches",
            value: stats.isLoading ? "…" : stats.total.toString(),
            description: "Branches on record",
            icon: Building2,
          },
        ]}
      />

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
                placeholder="Search branches..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${branches.length} of ${totalBranches} branches`}
                presets={{
                  storageKey: "branches",
                  rows: filters.rows,
                  fields: BRANCH_TABLE_FILTER_FIELDS,
                  onApply: (rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  },
                }}
                onClearAll={
                  hasActiveFilters
                    ? () => {
                        setFilters(defaultFilters);
                        setPage(1);
                      }
                    : undefined
                }
              >
                <TableAdvancedFilterBuilder
                  open={filtersOpen}
                  rows={filters.rows}
                  fields={BRANCH_TABLE_FILTER_FIELDS}
                  onChange={(rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  }}
                />
              </TableFilterPanel>
            }
          />
        </CardHeader>

        {listErrorMessage ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{listErrorMessage}</div>
        ) : null}

        <TableSelectionToolbar
          selectedIds={selectedIds.map(String)}
          pageRowIds={branches.map((branch) => String(branch.id))}
          totalCount={totalBranches}
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
            sort={sort}
            onSortChange={onSortChange}
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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
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
            externalError={formError}
            onSubmit={saveBranch}
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
