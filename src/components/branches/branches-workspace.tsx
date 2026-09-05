"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  Plus,
  Trash2,
} from "lucide-react";

import { BranchForm } from "@/components/branches/branch-form";
import { BranchViewSheet } from "@/components/branches/branch-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
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
import { useBranchFilterFields } from "@/lib/branches/hooks/use-branch-filter-fields";
import { useTranslation } from "@/lib/i18n";
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
  areBranchFormValuesEquivalent,
} from "@/lib/branches/types";
import type { DataTableColumn } from "@/lib/table/types";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import { buildToolbarSearchSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";

const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: BranchFilterState = {
  query: "",
  rows: [],
};

export function BranchesWorkspace() {
  const { t } = useTranslation();
  const branchFilterFields = useBranchFilterFields();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess } = useFeedback();
  const [filters, setFilters] = useState<BranchFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
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
        limit: pageLimit,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useBranches(listParams);
  const stats = useBranchStats();
  const createBranchMutation = useCreateBranch();
  const updateBranchMutation = useUpdateBranch();
  const deleteBranchesMutation = useDeleteBranches();

  const branches = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const totalBranches = data?.total ?? 0;
  rememberTotal(totalBranches);
  const totalPages = Math.max(1, Math.ceil(totalBranches / pageLimit));
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
      openFormTab({ feature: "branches", baseHref: "/branches", mode: "add", label: t("branches.actions.add") });
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
        label: t("branches.actions.editNamed", { name: branch.name }),
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
        if (areBranchFormValuesEquivalent(values, branchToFormValues(editingBranch))) {
          notifySuccess(t("common.form.noChanges"));
          setFormMode(null);
          setEditingBranch(null);
          return;
        }

        const nextBranch = await updateBranchMutation.mutateAsync({
          branchId: editingBranch.id,
          values,
        });
        notifyUpdated(t("branches.entity"), nextBranch.name);
      } else {
        const nextBranch = await createBranchMutation.mutateAsync(values);
        notifyAdded(t("branches.entity"), nextBranch.name);
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
      notifyDeleted(t("branches.entity"), ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const dash = t("common.empty.dash");

  const tableColumns: DataTableColumn<Branch>[] = useMemo(
    () => [
      {
        id: "id",
        label: t("branches.columns.id"),
        cellClassName: "font-mono text-xs",
        renderCell: (branch) => formatBranchId(branch.id),
      },
      {
        id: "name",
        label: t("branches.columns.name"),
        cellClassName: "font-medium",
        renderCell: (branch) => branch.name,
      },
      {
        id: "code",
        label: t("branches.columns.code"),
        renderCell: (branch) => branch.code || dash,
      },
      {
        id: "type",
        label: t("branches.columns.type"),
        truncateCell: false,
        cellClassName: "overflow-visible",
        renderCell: (branch) =>
          branch.type ? (
            <TableTagText className={getBranchTypeBadgeClass(branch.type)}>
              {branch.type}
            </TableTagText>
          ) : (
            dash
          ),
      },
      {
        id: "phone1",
        label: t("branches.columns.phone1"),
        renderCell: (branch) => formatPhoneDisplayOrDash(branch.phone1),
      },
      {
        id: "phone2",
        label: t("branches.columns.phone2"),
        renderCell: (branch) => formatPhoneDisplayOrDash(branch.phone2),
      },
      {
        id: "phones",
        label: t("branches.columns.phones"),
        sortField: "phone1",
        renderCell: (branch) => formatBranchPhones(branch),
      },
      {
        id: "address.city",
        label: t("branches.columns.address.city"),
        renderCell: (branch) => branch.address.city || dash,
      },
      {
        id: "address.state",
        label: t("branches.columns.address.state"),
        renderCell: (branch) => branch.address.state || dash,
      },
      {
        id: "address.country",
        label: t("branches.columns.address.country"),
        renderCell: (branch) => branch.address.country || dash,
      },
      {
        id: "address",
        label: t("branches.columns.address.full"),
        sortField: "address.address1",
        renderCell: (branch) => formatBranchAddress(branch),
      },
      {
        id: "settings.labelPrefix",
        label: t("branches.columns.settings.labelPrefix"),
        renderCell: (branch) => branch.settings.labelPrefix || dash,
      },
      {
        id: "created",
        label: t("branches.columns.created"),
        cellClassName: "text-muted-foreground",
        renderCell: (branch) => (branch.created ? formatAuditDateTime(branch.created) : dash),
      },
    ],
    [dash, t],
  );

  const columnVisibility = useColumnVisibility("branches", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const activeFilterCount = countCompleteFilterRows(filters.rows, branchFilterFields);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveFilters,
      query: filters.query,
      isSearchPending,
      matched: totalBranches,
      catalogTotal: stats.total,
      noun: t("branches.noun"),
      isLoading: isFetching && branches.length === 0,
      catalogLoading: stats.isLoading,
    },
    t,
  );
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: branches.length,
      page: currentPage,
      pageSize: pageLimit,
      total: totalBranches,
      noun: t("branches.noun"),
      isFiltered: hasActiveFilters,
      isLoading: isFetching,
      catalogTotal: stats.total,
      catalogLoading: stats.isLoading,
    },
    t,
  );

  return (
    <div>
      <PageHeader
        title={t("branches.title")}
        description={t("branches.pages.description")}
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            {t("branches.actions.add")}
          </Button>
        }
      />

      <StatCards
        items={[
          {
            label: t("branches.stats.total.label"),
            value: stats.isLoading ? "…" : stats.total.toString(),
            description: t("branches.stats.total.description"),
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
                placeholder={t("branches.search.placeholder")}
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={listSummary}
                presets={{
                  storageKey: "branches",
                  rows: filters.rows,
                  fields: branchFilterFields,
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
                  fields={branchFilterFields}
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
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            {t("branches.loading.list")}
          </div>
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
            activeRowId={viewBranch ? String(viewBranch.id) : undefined}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveFilters ? t("branches.empty.noMatch") : t("branches.empty.noneYet")}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  {t("branches.actions.add")}
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{listSummary}</p>
          <TablePaginationControls
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            disabled={isLoading}
          />
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
            <DialogTitle>
              {formMode === "edit" ? t("branches.form.editTitle") : t("branches.form.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <BranchForm
            key={editingBranch?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingBranch
                ? branchToFormValues(editingBranch)
                : createEmptyBranchForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("branches.actions.add")}
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
              {Array.isArray(deleteTarget) && deleteTarget.length > 1
                ? t("branches.dialogs.deleteTitlePlural")
                : t("branches.dialogs.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("branches.dialogs.deleteMany", {
                    count: deleteTarget.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("branches.dialogs.deleteOne", {
                    name:
                      !Array.isArray(deleteTarget) && deleteTarget?.name
                        ? deleteTarget.name
                        : t("branches.dialogs.unnamed"),
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isSaving}>
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton isPending={isSaving} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
