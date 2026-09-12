"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { RouteForm } from "@/components/route-manager/route-form";
import { RouteViewSheet } from "@/components/route-manager/route-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
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
import { useUserError } from "@/lib/errors/use-user-error";
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";
import { formatBranchCodeOnly, getBranchCodeBadgeClass } from "@/lib/branches/display";
import { useDirectoryBranchFilter } from "@/lib/branches/hooks/use-directory-branch-filter";
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
  getRouteBranchCode,
  routeToFormValues,
  type Route,
  type RouteFormValues,
  areRouteFormValuesEquivalent,
} from "@/lib/route-manager/types";
import type { DataTableColumn } from "@/lib/table/types";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTranslation } from "@/lib/i18n";

const SEARCH_DEBOUNCE_MS = 300;

export function RouteManagerWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess, notifyError } = useFeedback();
  const [query, setQuery] = useState("");
  const {
    branchCode,
    selectValue,
    setBranchCode,
    isReady: isBranchFilterReady,
    branchOptions,
    branches,
    branchesLoading,
  } = useDirectoryBranchFilter();
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const [viewAssignment, setViewAssignment] = useState<Route | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<Route | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Route | Route[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () => ({
      ...DEFAULT_ROUTE_LIST_PARAMS,
      page,
      limit: pageLimit,
      search: createApiListTextSearch(debouncedQuery),
      ...(branchCode.trim() ? { branchCode: branchCode.trim() } : {}),
    }),
    [branchCode, debouncedQuery, page, pageLimit],
  );

  const { data, isLoading, isError, error, isFetching } = useRoutes(listParams, {
    enabled: isBranchFilterReady,
  });
  const createMutation = useCreateRoute();
  const updateMutation = useUpdateRoute();
  const deleteMutation = useDeleteRoutes();

  const assignments = useResolvedPaginatedItems(
    data?.items,
    data?.total,
    isFetching || !isBranchFilterReady,
  );
  const totalAssignments = data?.total ?? 0;
  rememberTotal(totalAssignments);
  const totalPages = Math.max(1, Math.ceil(totalAssignments / pageLimit));
  const currentPage = Math.min(page, totalPages);

  const allPageSelected =
    assignments.length > 0 && assignments.every((assignment) => selectedIds.includes(assignment.id));
  const isSaving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  useTableSelectionReset(
    buildTableSelectionResetKey(debouncedQuery, branchCode),
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
        if (areRouteFormValuesEquivalent(values, routeToFormValues(editingAssignment))) {
          notifySuccess(t("common.form.noChanges"));
          setFormMode(null);
          setEditingAssignment(null);
          return;
        }

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
      setFormError(toErrorMessage(mutationError));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((assignment) => assignment.id)
      : [deleteTarget.id];

    try {
      const result = await deleteMutation.mutateAsync(ids);

      reportBulkSettled({
        result,
        t,
        entityLabel: t("routes.entities.route"),
        notifyDeleted,
        notifyError,
        onAllFailed: (message) => {
          setFormError(message);
        },
        onDone: () => {
          setSelectedIds((current) => current.filter((id) => !result.succeededIds.includes(id)));
          setDeleteTarget(null);
          setViewAssignment(null);
        },
      });
    } catch (mutationError) {
      setFormError(toErrorMessage(mutationError));
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
      id: "active",
      label: t("routes.activeRoute.status"),
      renderCell: (assignment) =>
        assignment.active ? t("routes.activeRoute.active") : t("routes.activeRoute.inactive"),
    },
    {
      id: "employees",
      label: t("routes.columns.employees"),
      renderCell: (assignment) => getRouteEmployeesLabel(assignment.employees),
    },
    {
      id: "branch",
      label: t("routes.columns.branch"),
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (assignment) => (
        <TableTagText
          className={getBranchCodeBadgeClass(getRouteBranchCode(assignment), branches)}
        >
          {formatBranchCodeOnly(getRouteBranchCode(assignment), branches)}
        </TableTagText>
      ),
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

  const columnVisibility = useColumnVisibility("routes-v4", tableColumns);

  const hasActiveFilters = Boolean(query.trim()) || Boolean(branchCode.trim());

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col">
      <PageHeader
        title={t("routes.routeManager.title")}
        description={t("routes.pages.routeManager")}
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
            search={
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <TableSearchInput
                    value={query}
                    onChange={(nextQuery) => {
                      setQuery(nextQuery);
                      setPage(1);
                    }}
                    placeholder={t("routes.table.searchPlaceholder")}
                  />
                </div>
                <SearchableSelect
                  id="routes-branch-filter"
                  aria-label={t("routes.table.branchFilter")}
                  value={selectValue}
                  onValueChange={(nextBranchCode) => {
                    setBranchCode(nextBranchCode);
                    setPage(1);
                  }}
                  options={branchOptions}
                  loading={branchesLoading}
                  loadingMessage={t("common.loading")}
                  placeholder={t("routes.table.branchFilter")}
                  searchPlaceholder={t("routes.table.branchFilterSearch")}
                  truncateSelection={false}
                  fitToOptions
                  className="max-w-full shrink-0"
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
            {toErrorMessage(error)}
          </div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={assignments}
            page={currentPage}
            isPageDataPending={isFetching || !isBranchFilterReady}
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
            activeRowId={viewAssignment?.id}
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
          <TablePaginationControls
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            disabled={isLoading || !isBranchFilterReady}
          />
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
            <ConfirmDeleteButton isPending={isSaving} onClick={confirmDelete} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
