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
import { UniformWidthPill } from "@/components/app-shell/uniform-width-pill";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { StatCardsGrid } from "@/components/app-shell/stat-cards-grid";

import { TableSelectionBar } from "@/components/app-shell/table-selection-bar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
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
import { formatAuditDate } from "@/lib/audit/display";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import {
  computeRoleKpis,
  formatPermissionsSummary,
  roleMatchesQuery,
  truncateRoleId,
} from "@/lib/roles/display";
import {
  useCreateRole,
  useDeleteRoles,
  useRolePermissionCatalog,
  useRoles,
  useUpdateRole,
} from "@/lib/roles/hooks/use-roles";
import {
  createEmptyRoleForm,
  roleToFormValues,
  type Role,
  type RoleFilterState,
  type RoleFormValues,
} from "@/lib/roles/types";

const PAGE_SIZE = 8;

const defaultFilters: RoleFilterState = {
  query: "",
};

export function RolesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<RoleFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewRole, setViewRole] = useState<Role | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | Role[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const rolesQuery = useRoles();
  const permissionCatalogQuery = useRolePermissionCatalog();
  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();
  const deleteRolesMutation = useDeleteRoles();

  const roles = rolesQuery.data?.items ?? [];
  const assignedPermissionCatalog = useMemo(
    () => {
      const entries = roles.flatMap((role) =>
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
    [roles],
  );
  const permissionCatalog =
    permissionCatalogQuery.data?.length ? permissionCatalogQuery.data : assignedPermissionCatalog;
  const isSaving =
    createRoleMutation.isPending ||
    updateRoleMutation.isPending ||
    deleteRolesMutation.isPending;

  const filteredRoles = useMemo(() => {
    return roles.filter((role) => roleMatchesQuery(role, filters.query));
  }, [roles, filters]);

  const kpis = useMemo(() => computeRoleKpis(roles), [roles]);
  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRoles = filteredRoles.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected =
    pageRoles.length > 0 && pageRoles.every((role) => selectedIds.includes(role.roleId));

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

  function openAddForm() {
    setEditingRole(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(role: Role) {
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
        notifyUpdated("Role", nextRole.name);
      } else {
        const nextRole = await createRoleMutation.mutateAsync(values);
        notifyAdded("Role", nextRole.name);
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
      notifyDeleted("Role", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const stats = [
    { label: "Total roles", value: kpis.total.toString(), description: "Roles on record", icon: Shield },
    {
      label: "Total permissions",
      value: kpis.totalPermissions.toString(),
      description: "Assigned across all roles",
      icon: KeyRound,
    },
    {
      label: "Avg per role",
      value: kpis.averagePermissions.toString(),
      description: "Average permissions per role",
      icon: KeyRound,
    },
  ];

  const tableColumns: DataTableColumn<Role>[] = [
    {
      id: "roleId",
      label: "Role ID",
      cellClassName: "font-mono text-xs",
      renderCell: (role) => truncateRoleId(role.roleId),
    },
    {
      id: "name",
      label: "Role name",
      cellClassName: "font-medium",
      renderCell: (role) => role.name,
    },
    {
      id: "permissions",
      label: "Permissions",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (role) => (
        <div className="space-y-1">
          <UniformWidthPill columnKey="permissions">
            <Badge variant="secondary">{role.permissions.length} permissions</Badge>
          </UniformWidthPill>
          <p className="max-w-[320px] truncate text-xs text-muted-foreground">
            {formatPermissionsSummary(role, 4)}
          </p>
        </div>
      ),
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (role) => formatAuditDate(role.createdAt),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (role) => role.createdBy,
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (role) => formatAuditDate(role.updatedAt),
    },
    {
      id: "actions",
      label: "Action",
      hideable: false,
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
                aria-label={`Actions for ${role.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-36">
              <DropdownMenuItem onSelect={() => setViewRole(role)}>
                <Eye className="h-4 w-4" />
                View
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openEditForm(role)}>
                <Pencil className="h-4 w-4" />
                Edit
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
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("roles", tableColumns);
  const hasActiveFilters = Boolean(filters.query.trim());
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    matched: filteredRoles.length,
    catalogTotal: roles.length,
    noun: "roles",
  });
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
        title="Roles"
        actions={
          <Button
            onClick={openAddForm}
            disabled={rolesQuery.isLoading || permissionCatalog.length === 0}
          >
            <Plus className="h-4 w-4" />
            Add role
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

      <Card className="mt-6">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            showFilterToggle={false}
            columnLayout={columnVisibility}
            searchSummary={searchSummary}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters((current) => ({ ...current, query }));
                  setPage(1);
                }}
                placeholder="Search roles..."
              />
            }
          />
        </CardHeader>

        {pageError ? (
          <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">
            {pageError}
          </div>
        ) : null}

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={pageRoles.map((role) => role.roleId)}
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
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading roles…</div>
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
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewRole}
            onRowDoubleClick={openEditForm}
            emptyState={
              <>
                <p className="text-muted-foreground">No roles match your search.</p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add role
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {rolesQuery.isFetching
              ? "Refreshing roles…"
              : `Showing ${pageRoles.length} of ${filteredRoles.length} roles`}
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
            <SheetTitle>{formMode === "edit" ? "Edit role" : "Add role"}</SheetTitle>
            <SheetDescription>
              {formMode === "edit"
                ? "Update the role name and choose its permissions."
                : "Name the role and choose the permissions it should have."}
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
            submitLabel={formMode === "edit" ? "Save changes" : "Add role"}
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
            <DialogTitle>Delete role{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected roles.`
                : "This will permanently remove this role. This action cannot be undone."}
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
