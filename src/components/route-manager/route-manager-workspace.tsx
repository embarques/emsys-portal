"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import { RouteForm } from "@/components/route-manager/route-form";
import { RouteViewSheet } from "@/components/route-manager/route-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { PageHeader } from "@/components/app-shell/page-header";
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
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { formatBranchCodeOnly, formatBranchFilterLabel, getBranchCodeBadgeClass } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { createApiListTextSearch } from "@/lib/api/search-query";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { formatAuditDateTime } from "@/lib/audit/display";
import {
  formatRouteName,
  getRouteEmployeesLabel,
} from "@/lib/route-manager/display";
import {
  useCreateRoute,
  useDeleteRoutes,
  useRoutes,
  useUpdateRoute,
} from "@/lib/route-manager/hooks/use-route-manager";
import {
  DEFAULT_ROUTE_LIST_PARAMS,
  createEmptyRouteForm,
  routeToFormValues,
  type Route,
  type RouteFilterState,
  type RouteFormValues,
} from "@/lib/route-manager/types";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { useTranslation } from "@/lib/i18n";

const PAGE_SIZE = DEFAULT_ROUTE_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: RouteFilterState = {
  query: "",
  branchCode: "",
};

export function RouteManagerWorkspace() {
  const { t } = useTranslation();
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<RouteFilterState>(defaultFilters);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewAssignment, setViewAssignment] = useState<Route | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Route | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Route | Route[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () => ({
      ...DEFAULT_ROUTE_LIST_PARAMS,
      page,
      limit: PAGE_SIZE,
      search: createApiListTextSearch(debouncedQuery),
      ...(filters.branchCode.trim() ? { branchCode: filters.branchCode.trim() } : {}),
    }),
    [debouncedQuery, filters.branchCode, page],
  );

  const branchesQuery = useBranchPicker(200);
  const branches = useMemo(() => branchesQuery.data?.items ?? [], [branchesQuery.data?.items]);
  const branchOptions = useMemo(() => {
    return [
      { value: "", label: t("routes.table.allBranches"), keywords: ["all"] },
      ...branches.map((branch) => ({
        value: branch.code,
        label: formatBranchFilterLabel(branch),
        keywords: [branch.code, branch.name],
      })),
    ];
  }, [branches, t]);

  const { data, isLoading, isError, error, isFetching } = useRoutes(listParams);
  const createMutation = useCreateRoute();
  const updateMutation = useUpdateRoute();
  const deleteMutation = useDeleteRoutes();

  const assignments = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const totalAssignments = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalAssignments / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const allPageSelected =
    assignments.length > 0 && assignments.every((assignment) => selectedIds.includes(assignment.id));
  const isSaving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  useTableSelectionReset(
    buildTableSelectionResetKey(debouncedQuery, filters.branchCode),
    setSelectedIds,
  );

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

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

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({
        feature: "routes",
        baseHref: "/routes",
        mode: "add",
        label: t("routes.form.addTabLabel"),
      });
      return;
    }
    setEditingAssignment(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(assignment: Route) {
    if (isDesktopTabs) {
      setViewAssignment(null);
      openFormTab({
        feature: "routes",
        baseHref: "/routes",
        mode: "edit",
        entityId: assignment.id,
        label: t("routes.form.editTabLabel", { name: formatRouteName(assignment) }),
      });
      return;
    }
    setEditingAssignment(assignment);
    setFormMode("edit");
    setViewAssignment(null);
    setFormError(null);
  }

  async function saveAssignment(values: RouteFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingAssignment) {
        const nextAssignment = await updateMutation.mutateAsync({
          recordId: editingAssignment.id,
          values,
        });
        notifyUpdated(t("routes.form.entityLabel"), formatRouteName(nextAssignment));
      } else {
        const nextAssignment = await createMutation.mutateAsync(values);
        notifyAdded(t("routes.form.entityLabel"), formatRouteName(nextAssignment));
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
      notifyDeleted(t("routes.entities.route"), ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const dash = t("common.empty.dash");

  const tableColumns: DataTableColumn<Route>[] = [
    {
      id: "name",
      label: t("routes.columns.name"),
      cellClassName: "font-medium",
      renderCell: (assignment) => formatRouteName(assignment),
    },
    {
      id: "employees",
      label: t("routes.columns.employees"),
      renderCell: (assignment) => getRouteEmployeesLabel(assignment.employees),
    },
    {
      id: "vehicle.branch",
      label: t("routes.columns.branch"),
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (assignment) => (
        <TableTagText
          className={getBranchCodeBadgeClass(assignment.vehicle.branch ?? "", branches)}
        >
          {formatBranchCodeOnly(assignment.vehicle.branch ?? "", branches)}
        </TableTagText>
      ),
    },
    {
      id: "vehicle.name",
      label: t("routes.columns.vehicle"),
      renderCell: (assignment) => assignment.vehicle.name || dash,
    },
    {
      id: "createdAt",
      label: t("routes.columns.createdAt"),
      cellClassName: "text-muted-foreground",
      renderCell: (assignment) =>
        assignment.createdAt ? formatAuditDateTime(assignment.createdAt) : dash,
    },
    {
      id: "createdBy",
      label: t("routes.columns.createdBy"),
      cellClassName: "text-muted-foreground",
      renderCell: (assignment) => assignment.createdBy || dash,
    },
    {
      id: "updatedAt",
      label: t("routes.columns.updatedAt"),
      cellClassName: "text-muted-foreground",
      renderCell: (assignment) =>
        assignment.updatedAt ? formatAuditDateTime(assignment.updatedAt) : dash,
    },
  ];

  const columnVisibility = useColumnVisibility("routes-v2", tableColumns);

  const hasActiveFilters = Boolean(filters.query.trim()) || Boolean(filters.branchCode.trim());
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveFilters,
      query: filters.query,
      isSearchPending,
      matched: totalAssignments,
      noun: t("routes.noun"),
      isLoading: isFetching && assignments.length === 0,
    },
    t,
  );

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col">
      <PageHeader
        title={t("routes.routeManager.title")}
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            {t("routes.actions.addRoute")}
          </Button>
        }
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            showFilterToggle={false}
            columnLayout={columnVisibility}
            searchSummary={searchSummary}
            search={
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <TableSearchInput
                    value={filters.query}
                    onChange={(query) => {
                      setFilters((current) => ({ ...current, query }));
                      setPage(1);
                    }}
                    placeholder={t("routes.table.searchPlaceholder")}
                  />
                </div>
                <SearchableSelect
                  id="routes-branch-filter"
                  aria-label={t("routes.table.branchFilter")}
                  value={filters.branchCode}
                  onValueChange={(branchCode) => {
                    setFilters((current) => ({ ...current, branchCode }));
                    setPage(1);
                  }}
                  options={branchOptions}
                  loading={branchesQuery.isLoading}
                  loadingMessage={t("common.loading")}
                  placeholder={t("routes.table.branchFilterPlaceholder")}
                  searchPlaceholder={t("routes.table.branchFilterSearch")}
                  className="w-[min(100%,14rem)] shrink-0"
                />
              </div>
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
            setDeleteTarget(
              assignments.filter((assignment) => selectedIds.includes(assignment.id)),
            )
          }
        />

        {isError ? (
          <div className="px-6 py-8 text-sm text-destructive">
            {normalizeApiError(error).message}
          </div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={assignments}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(assignment) => assignment.id}
            rowLabel={(assignment) => formatRouteName(assignment)}
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
                  {hasActiveFilters
                    ? t("routes.table.emptyFiltered")
                    : t("routes.table.empty")}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  {t("routes.actions.addRoute")}
                </Button>
              </>
            }
          />
        )}

        <div className="flex shrink-0 flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {t("routes.table.pagination", {
              shown: assignments.length,
              total: totalAssignments,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              {t("common.actions.previous")}
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              {t("common.pagination.pageOf", { current: currentPage, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages || isLoading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              {t("common.actions.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <RouteViewSheet
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
            <DialogTitle>
              {formMode === "edit"
                ? t("routes.form.editTitle")
                : t("routes.form.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {formMode === "edit"
                ? t("routes.form.editDescription")
                : t("routes.form.addDescription")}
            </DialogDescription>
          </DialogHeader>
          <RouteForm
            key={editingAssignment?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingAssignment
                ? routeToFormValues(editingAssignment)
                : createEmptyRouteForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={
              formMode === "edit"
                ? t("common.actions.saveChanges")
                : t("routes.form.addTitle")
            }
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
              {Array.isArray(deleteTarget) && deleteTarget.length > 1
                ? t("common.dialogs.deleteManyTitle", {
                    entities: t("routes.entities.routes"),
                  })
                : t("common.dialogs.deleteOneTitle", {
                    entity: t("routes.entities.route"),
                  })}
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("common.dialogs.deleteManyDescription", {
                    count: deleteTarget.length,
                    entities: t("routes.entities.routes"),
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("common.dialogs.deleteOneDescription", {
                    name:
                      deleteTarget?.name?.trim() ||
                      (deleteTarget ? formatRouteName(deleteTarget) : t("routes.entities.route")),
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isSaving}>
              {t("common.actions.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isSaving}>
              <Trash2 className="h-4 w-4" />
              {t("common.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
