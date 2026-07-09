"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";

import { RoleForm } from "@/components/roles/role-form";
import { RoleViewSheet } from "@/components/roles/role-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCards } from "@/components/app-shell/stat-cards-carousel";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { useTranslation } from "@/lib/i18n";
import { useRoleFilterFields } from "@/lib/roles/hooks/use-role-filter-fields";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { normalizeApiError } from "@/lib/api/axios";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatAuditDateTime } from "@/lib/audit/display";
import type { DataTableColumn } from "@/lib/table/types";
import { useTableSort } from "@/lib/table/use-table-sort";
import { buildToolbarSearchSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";
import {
  computeRoleKpis,
  formatPermissionsSummary,
  truncateRoleId,
} from "@/lib/roles/display";
import {
  useCreateRole,
  useDeleteRoles,
  useRoleKpis,
  useRolePermissionCatalog,
  useRoleStats,
  useRoles,
  useUpdateRole,
} from "@/lib/roles/hooks/use-roles";
import { mergePermissionCatalogEntries } from "@/lib/roles/permissions-catalog";
import {
  DEFAULT_ROLE_LIST_PARAMS,
  buildRoleListParams,
  createEmptyRoleForm,
  roleToFormValues,
  type Role,
  type RoleFilterState,
  type RoleFormValues,
} from "@/lib/roles/types";

const PAGE_SIZE = DEFAULT_ROLE_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: RoleFilterState = {
  query: "",
  rows: [],
};

export function RolesWorkspace() {
  const { t } = useTranslation();
  const roleFilterFields = useRoleFilterFields();
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<RoleFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_ROLE_LIST_PARAMS.sort, () => setPage(1));
  const [viewRole, setViewRole] = useState<Role | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | Role[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () =>
      buildRoleListParams({
        page,
        limit: PAGE_SIZE,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, sort],
  );

  const rolesQuery = useRoles(listParams);
  const permissionCatalogQuery = useRolePermissionCatalog();
  const roleStats = useRoleStats();
  const kpiQuery = useRoleKpis();
  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();
  const deleteRolesMutation = useDeleteRoles();

  const roles = useResolvedPaginatedItems(
    rolesQuery.data?.items,
    rolesQuery.data?.total,
    rolesQuery.isFetching,
  );
  const totalRoles = rolesQuery.data?.total ?? 0;
  const assignedPermissionCatalog = useMemo(
    () => {
      const entries = kpiQuery.items.flatMap((role) =>
        role.permissions
          .filter((permission) => permission.group)
          .map((permission) => ({
            id: permission.id,
            value: permission.value,
            label: permission.label ?? permission.value,
            group: permission.group!,
          })),
      );

      return Array.from(new Map(entries.map((entry) => [entry.id, entry])).values());
    },
    [kpiQuery.items],
  );
  const basePermissionCatalog = useMemo(() => {
    if (permissionCatalogQuery.data) {
      return permissionCatalogQuery.data;
    }

    if (permissionCatalogQuery.isError) {
      return assignedPermissionCatalog;
    }

    return [];
  }, [
    assignedPermissionCatalog,
    permissionCatalogQuery.data,
    permissionCatalogQuery.isError,
  ]);

  const permissionCatalog = useMemo(() => {
    if (!editingRole) return basePermissionCatalog;
    return mergePermissionCatalogEntries(basePermissionCatalog, editingRole.permissions);
  }, [basePermissionCatalog, editingRole]);
  const isSaving =
    createRoleMutation.isPending ||
    updateRoleMutation.isPending ||
    deleteRolesMutation.isPending;

  const kpis = useMemo(() => computeRoleKpis(kpiQuery.items), [kpiQuery.items]);
  const totalPages = Math.max(1, Math.ceil(totalRoles / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRoles = roles;
  const allPageSelected =
    pageRoles.length > 0 && pageRoles.every((role) => selectedIds.includes(role.roleId));

  useTableSelectionReset(
    buildTableSelectionResetKey(debouncedQuery, filters.rows),
    setSelectedIds,
  );

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...pageRoles.map((role) => role.roleId)]))
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !pageRoles.some((role) => role.roleId === id))
    );
  }

  function toggleSelect(roleId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, roleId] : current.filter((entry) => entry !== roleId)
    );
  }

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({ feature: "roles", baseHref: "/roles", mode: "add", label: t("roles.actions.add") });
      return;
    }
    setEditingRole(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(role: Role) {
    if (isDesktopTabs) {
      setViewRole(null);
      openFormTab({
        feature: "roles",
        baseHref: "/roles",
        mode: "edit",
        entityId: role.roleId,
        label: t("roles.actions.editNamed", { name: role.name }),
      });
      return;
    }
    setEditingRole(role);
    setFormMode("edit");
    setViewRole(null);
    setFormError(null);
  }

  async function saveRole(values: RoleFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingRole) {
        const nextRole = await updateRoleMutation.mutateAsync({
          roleId: editingRole.roleId,
          values,
        });
        notifyUpdated(t("roles.entity"), nextRole.name);
      } else {
        const nextRole = await createRoleMutation.mutateAsync(values);
        notifyAdded(t("roles.entity"), nextRole.name);
      }

      setFormMode(null);
      setEditingRole(null);
      setFormError(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setFormError(null);
    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((role) => role.roleId)
      : [deleteTarget.roleId];

    try {
      await deleteRolesMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewRole(null);
      notifyDeleted(t("roles.entity"), ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const statCards = [
    {
      label: t("roles.stats.total.label"),
      value: roleStats.isLoading ? "…" : roleStats.total.toString(),
      description: t("roles.stats.total.description"),
      icon: Shield,
    },
    {
      label: t("roles.stats.totalPermissions.label"),
      value: kpiQuery.isLoading ? "…" : kpis.totalPermissions.toString(),
      description: t("roles.stats.totalPermissions.description"),
      icon: KeyRound,
    },
    {
      label: t("roles.stats.avgPerRole.label"),
      value: kpiQuery.isLoading ? "…" : kpis.averagePermissions.toString(),
      description: t("roles.stats.avgPerRole.description"),
      icon: KeyRound,
    },
  ];

  const dash = t("common.empty.dash");

  const tableColumns: DataTableColumn<Role>[] = [
    {
      id: "roleId",
      label: t("roles.columns.roleId"),
      sortField: "id",
      cellClassName: "font-mono text-xs",
      renderCell: (role) => truncateRoleId(role.roleId),
    },
    {
      id: "name",
      label: t("roles.columns.name"),
      cellClassName: "font-medium",
      renderCell: (role) => role.name,
    },
    {
      id: "permissions",
      label: t("roles.columns.permissions"),
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (role) => (
        <div className="space-y-1">
          <TableTagText>{t("roles.table.permissionsCount", { count: role.permissions.length })}</TableTagText>
          <p className="max-w-[320px] truncate text-xs text-muted-foreground">
            {formatPermissionsSummary(role, 4)}
          </p>
        </div>
      ),
    },
    {
      id: "createdAt",
      label: t("roles.columns.createdAt"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (role) => formatAuditDateTime(role.createdAt),
    },
    {
      id: "createdBy",
      label: t("roles.columns.createdBy"),
      cellClassName: "text-muted-foreground",
      renderCell: (role) => role.createdBy || dash,
    },
    {
      id: "updatedAt",
      label: t("roles.columns.updatedAt"),
      defaultVisible: false,
      cellClassName: "text-muted-foreground",
      renderCell: (role) => formatAuditDateTime(role.updatedAt),
    },
    {
      id: "actions",
      label: t("roles.columns.action"),
      hideable: false,
      sortable: false,
      truncateCell: false,
      stopRowClick: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (role) => (
        <div className="flex justify-end" onDoubleClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("roles.table.actionsFor", { name: role.name })}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem onSelect={() => setViewRole(role)}>
                <Eye className="h-4 w-4" />
                {t("roles.actions.view")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openEditForm(role)}>
                <Pencil className="h-4 w-4" />
                {t("common.actions.edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={role.systemRole}
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  setFormError(null);
                  setDeleteTarget(role);
                }}
              >
                <Trash2 className="h-4 w-4" />
                {t("common.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("roles", tableColumns);
  const activeFilterCount = countCompleteFilterRows(filters.rows, roleFilterFields);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveFilters,
      query: filters.query,
      isSearchPending,
      matched: totalRoles,
      catalogTotal: roleStats.total,
      noun: t("roles.noun"),
      isLoading: rolesQuery.isFetching && roles.length === 0,
      catalogLoading: roleStats.isLoading,
    },
    t,
  );
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: pageRoles.length,
      page: currentPage,
      pageSize: PAGE_SIZE,
      total: totalRoles,
      noun: t("roles.noun"),
      isFiltered: hasActiveFilters,
      isLoading: rolesQuery.isFetching,
      catalogTotal: roleStats.total,
      catalogLoading: roleStats.isLoading,
    },
    t,
  );
  const pageError = rolesQuery.isError
    ? normalizeApiError(rolesQuery.error).message
    : permissionCatalogQuery.isError && permissionCatalog.length === 0
      ? normalizeApiError(permissionCatalogQuery.error).message
      : formMode === null
        ? formError
        : null;

  return (
    <div>
      <PageHeader
        title={t("roles.title")}
        description={t("roles.pages.description")}
        actions={
          <Button
            onClick={openAddForm}
            disabled={rolesQuery.isLoading || permissionCatalog.length === 0}
          >
            <Plus className="h-4 w-4" />
            {t("roles.actions.add")}
          </Button>
        }
      />

      <StatCards items={statCards} />

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
                placeholder={t("roles.search.placeholder")}
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={listSummary}
                presets={{
                  storageKey: "roles",
                  rows: filters.rows,
                  fields: roleFilterFields,
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
                  fields={roleFilterFields}
                  onChange={(rows) => {
                    setFilters((current) => ({ ...current, rows }));
                    setPage(1);
                  }}
                />
              </TableFilterPanel>
            }
          />
        </CardHeader>

        {pageError ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">
            {pageError}
          </div>
        ) : null}

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={pageRoles.map((role) => role.roleId)}
          totalCount={totalRoles}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const role = pageRoles.find((entry) => entry.roleId === selectedIds[0]);
            if (role) openEditForm(role);
          }}
          onDelete={() => {
            setFormError(null);
            setDeleteTarget(roles.filter((role) => selectedIds.includes(role.roleId)));
          }}
          deleteDisabled={
            isSaving || roles.some((role) => selectedIds.includes(role.roleId) && role.systemRole)
          }
        />

        {rolesQuery.isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">{t("roles.loading.list")}</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageRoles}
            page={currentPage}
            isPageDataPending={rolesQuery.isFetching}
            rowKey={(role) => role.roleId}
            rowLabel={(role) => role.name}
            columnLayout={columnVisibility}
            minWidth={1100}
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewRole}
            onRowDoubleClick={openEditForm}
            activeRowId={viewRole?.roleId}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveFilters ? t("roles.empty.noMatch") : t("roles.empty.noneYet")}
                </p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  {t("roles.actions.add")}
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{listSummary}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
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
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              {t("common.actions.next")}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <RoleViewSheet
        role={viewRole}
        permissionCatalog={permissionCatalog}
        open={Boolean(viewRole)}
        onOpenChange={(open) => {
          if (!open) setViewRole(null);
        }}
        onEdit={openEditForm}
        onDelete={(role) => {
          setFormError(null);
          setViewRole(null);
          setDeleteTarget(role);
        }}
      />

      <Sheet
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            setFormError(null);
          }
        }}
      >
        <SheetContent className="flex w-full max-w-full flex-col p-0 sm:w-[560px] sm:max-w-[90vw]">
          <SheetHeader className="shrink-0 border-b px-6 py-5 pr-16">
            <SheetTitle>
              {formMode === "edit" ? t("roles.form.editTitle") : t("roles.form.addTitle")}
            </SheetTitle>
            <SheetDescription>
              {formMode === "edit" ? t("roles.form.editDescription") : t("roles.form.addDescription")}
            </SheetDescription>
          </SheetHeader>
          <RoleForm
            key={editingRole?.roleId ?? "new"}
            initialValues={
              formMode === "edit" && editingRole ? roleToFormValues(editingRole) : createEmptyRoleForm()
            }
            permissionCatalog={permissionCatalog}
            error={formError}
            isSubmitting={isSaving || permissionCatalogQuery.isLoading}
            submitLabel={formMode === "edit" ? t("common.actions.saveChanges") : t("roles.actions.add")}
            onSubmit={saveRole}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
        </SheetContent>
      </Sheet>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              {Array.isArray(deleteTarget) && deleteTarget.length > 1
                ? t("roles.dialogs.deleteTitlePlural")
                : t("roles.dialogs.deleteTitle")}
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? t("roles.dialogs.deleteMany", {
                    count: deleteTarget.length,
                    cannotBeUndone: t("common.dialogs.cannotBeUndone"),
                  })
                : t("roles.dialogs.deleteOne", {
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
