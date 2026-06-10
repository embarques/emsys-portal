"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";

import { RoleForm } from "@/components/roles/role-form";
import { RoleViewSheet } from "@/components/roles/role-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
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
import { formatAuditDate } from "@/lib/audit/display";
import type { DataTableColumn } from "@/lib/table/types";
import {
  computeRoleKpis,
  formatPermissionsSummary,
  roleMatchesQuery,
  truncateRoleId,
} from "@/lib/roles/display";
import { cloneRoles } from "@/lib/roles/mock-data";
import {
  createEmptyRoleForm,
  formValuesToRole,
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
  const [roles, setRoles] = useState<Role[]>(() => cloneRoles());
  const [filters, setFilters] = useState<RoleFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewRole, setViewRole] = useState<Role | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | Role[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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

  function saveRole(values: RoleFormValues) {
    try {
      if (formMode === "edit" && editingRole) {
        const nextRole = formValuesToRole(
          values,
          editingRole.createdAt,
          editingRole.createdBy,
          new Date().toISOString()
        );
        setRoles((current) =>
          current.map((role) => (role.roleId === editingRole.roleId ? nextRole : role))
        );
        notifyUpdated("Role", nextRole.name);
      } else {
        const nextRole = formValuesToRole(values);
        setRoles((current) => [nextRole, ...current]);
        notifyAdded("Role", nextRole.name);
      }

      setFormMode(null);
      setEditingRole(null);
      setFormError(null);
      setPage(1);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save role.");
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((role) => role.roleId)
      : [deleteTarget.roleId];
    setRoles((current) => current.filter((role) => !ids.includes(role.roleId)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewRole(null);
    notifyDeleted("Role", ids.length);
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
      renderCell: (role) => (
        <div className="space-y-1">
          <Badge variant="secondary">{role.permissions.length} permissions</Badge>
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
  ];

  const columnVisibility = useColumnVisibility("roles", tableColumns);

  return (
    <div>
      <PageHeader
        title="Roles"
        actions={
          <Button onClick={openAddForm}>
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
        <CardHeader className="gap-4 border-b pb-4">
          <TableDirectoryToolbar
            showFilterToggle={false}
            columnLayout={columnVisibility}
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

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={pageRoles.map((role) => role.roleId)}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const role = pageRoles.find((entry) => entry.roleId === selectedIds[0]);
            if (role) openEditForm(role);
          }}
          onDelete={() => setDeleteTarget(roles.filter((role) => selectedIds.includes(role.roleId)))}
        />

        <DataTable
          columns={columnVisibility.columns}
          rows={pageRoles}
          page={currentPage}
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

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageRoles.length} of {filteredRoles.length} roles
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
        open={Boolean(viewRole)}
        onOpenChange={(open) => {
          if (!open) setViewRole(null);
        }}
        onEdit={openEditForm}
        onDelete={(role) => {
          setViewRole(null);
          setDeleteTarget(role);
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
            <DialogTitle>{formMode === "edit" ? "Edit role" : "Add role"}</DialogTitle>
            <DialogDescription>
              {formMode === "edit"
                ? "Update the role name and adjust its permission list."
                : "Create a role and copy permissions from an existing role, or build the list from scratch."}
            </DialogDescription>
          </DialogHeader>
          <RoleForm
            key={editingRole?.roleId ?? "new"}
            initialValues={
              formMode === "edit" && editingRole ? roleToFormValues(editingRole) : createEmptyRoleForm()
            }
            existingRoles={roles}
            isEditing={formMode === "edit"}
            updatedAt={editingRole?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add role"}
            onSubmit={saveRole}
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
            <DialogTitle>Delete role{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected roles.`
                : "This will permanently remove this role. This action cannot be undone."}
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
