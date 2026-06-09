"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";

import { UserForm } from "@/components/users/user-form";
import { UserViewSheet } from "@/components/users/user-view-sheet";
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
import type { DataTableColumn } from "@/lib/table/types";
import {
  getUserBranchBadgeClass,
  getUserLanguageLabel,
  getUserRoleBadgeClass,
  getUserRoleLabel,
  getUserStatusBadgeClass,
  getUserStatusLabel,
  truncateUid,
  truncateUserId,
} from "@/lib/users/display";
import {
  useCreateUser,
  useDeleteUsers,
  useUsers,
  useUserStats,
  useUpdateUser,
} from "@/lib/users/hooks/use-users";
import {
  USER_BRANCHES,
  USER_ROLE_OPTIONS,
  USER_SEARCH_FIELDS,
  USER_SEARCH_OPERATORS,
  USER_STATUSES,
  createEmptyUserForm,
  createUserSearchFilter,
  formatUserBranchLabel,
  getUserSearchSortField,
  maskPassword,
  userToFormValues,
  type User,
  type UserFilterState,
  type UserFormValues,
} from "@/lib/users/types";

const PAGE_SIZE = 40;

const defaultFilters: UserFilterState = {
  query: "",
  searchField: "userName",
  searchOperator: "startsWith",
  branch: "all",
  status: "all",
  roleId: "all",
};

export function UsersWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<UserFilterState>(defaultFilters);
  const deferredQuery = useDeferredValue(filters.query);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | User[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () => {
      const search = createUserSearchFilter(deferredQuery, filters.searchField, filters.searchOperator);

      return {
        page,
        limit: PAGE_SIZE,
        sortField: search ? getUserSearchSortField(filters.searchField) : "userName",
        sortDirection: "asc" as const,
        search,
        branch: filters.branch,
        status: filters.status,
        roleId: filters.roleId,
      };
    },
    [
      deferredQuery,
      filters.branch,
      filters.roleId,
      filters.searchField,
      filters.searchOperator,
      filters.status,
      page,
    ],
  );

  const { data, isLoading, isError, error, isFetching } = useUsers(listParams);
  const stats = useUserStats();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUsersMutation = useDeleteUsers();

  const users = data?.items ?? [];
  const totalUsers = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = users;
  const allPageSelected =
    pageUsers.length > 0 && pageUsers.every((user) => selectedIds.includes(user.userId));
  const isSaving =
    createUserMutation.isPending || updateUserMutation.isPending || deleteUsersMutation.isPending;

  const roleFilters = useMemo(() => {
    const discoveredRoles = new Map<number, string>();
    for (const user of users) {
      if (user.roleId > 0) {
        discoveredRoles.set(user.roleId, user.roleName || `Role ${user.roleId}`);
      }
    }

    for (const option of USER_ROLE_OPTIONS) {
      if (!discoveredRoles.has(option.id)) {
        discoveredRoles.set(option.id, option.label);
      }
    }

    return [
      { value: "all" as const, label: "All roles" },
      ...Array.from(discoveredRoles.entries()).map(([id, label]) => ({
        value: id,
        label,
      })),
    ];
  }, [users]);

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...users.map((user) => user.userId)])),
      );
      return;
    }
    setSelectedIds((current) => current.filter((id) => !users.some((user) => user.userId === id)));
  }

  function toggleSelect(userId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...current, userId] : current.filter((entry) => entry !== userId),
    );
  }

  function openAddForm() {
    setEditingUser(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(user: User) {
    setEditingUser(user);
    setFormMode("edit");
    setViewUser(null);
    setFormError(null);
  }

  async function saveUser(values: UserFormValues) {
    setFormError(null);

    try {
      if (formMode === "edit" && editingUser) {
        const nextUser = await updateUserMutation.mutateAsync({
          userId: editingUser.userId,
          values: { ...values, createdBy: editingUser.createdBy },
        });
        notifyUpdated("User", nextUser.username);
      } else {
        const nextUser = await createUserMutation.mutateAsync(values);
        notifyAdded("User", nextUser.username);
      }

      setFormMode(null);
      setEditingUser(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((user) => user.userId)
      : [deleteTarget.userId];

    try {
      await deleteUsersMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      setDeleteTarget(null);
      setViewUser(null);
      notifyDeleted("User", ids.length);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeleteTarget(null);
    }
  }

  const statCards = [
    {
      label: "Total users",
      value: stats.isLoading ? "…" : stats.total.toString(),
      description: "Accounts on record",
      icon: Users,
    },
    {
      label: "Active",
      value: stats.isLoading ? "…" : stats.active.toString(),
      description: "Currently active",
      icon: UserCog,
    },
    {
      label: "Admins",
      value: stats.isLoading ? "…" : stats.admin.toString(),
      description: "Admin role accounts",
      icon: Shield,
    },
  ];

  const branchFilters: { value: UserFilterState["branch"]; label: string }[] = [
    { value: "all", label: "All branches" },
    ...USER_BRANCHES,
  ];

  const statusFilters: { value: UserFilterState["status"]; label: string }[] = [
    { value: "all", label: "All statuses" },
    ...USER_STATUSES,
  ];

  const tableColumns: DataTableColumn<User>[] = [
    {
      id: "userId",
      label: "User ID",
      cellClassName: "font-mono text-xs",
      renderCell: (user) => truncateUserId(user.userId),
    },
    {
      id: "uid",
      label: "UID",
      cellClassName: "font-mono text-xs text-muted-foreground",
      renderCell: (user) => (user.uid ? truncateUid(user.uid) : "—"),
    },
    {
      id: "username",
      label: "Username",
      cellClassName: "font-medium",
      renderCell: (user) => user.username,
    },
    {
      id: "password",
      label: "Password",
      cellClassName: "font-mono text-muted-foreground",
      renderCell: (user) => maskPassword(user.password),
    },
    {
      id: "name",
      label: "Name",
      renderCell: (user) => user.name || "—",
    },
    {
      id: "status",
      label: "Status",
      renderCell: (user) => (
        <Badge className={getUserStatusBadgeClass(user.status)}>{getUserStatusLabel(user.status)}</Badge>
      ),
    },
    {
      id: "role",
      label: "Role",
      renderCell: (user) => (
        <Badge className={getUserRoleBadgeClass(user.roleName)}>{getUserRoleLabel(user.roleName)}</Badge>
      ),
    },
    {
      id: "language",
      label: "Language",
      renderCell: (user) => getUserLanguageLabel(user.language),
    },
    {
      id: "branch",
      label: "Branch",
      renderCell: (user) => (
        <Badge className={getUserBranchBadgeClass(user.branch)}>{formatUserBranchLabel(user)}</Badge>
      ),
    },
    {
      id: "email",
      label: "Email",
      renderCell: (user) => user.email || "—",
    },
    {
      id: "phone",
      label: "Phone number",
      renderCell: (user) => user.phone || "—",
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (user) => (user.createdAt ? formatAuditDate(user.createdAt) : "—"),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (user) => user.createdBy || "—",
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (user) => (user.updatedAt ? formatAuditDate(user.updatedAt) : "—"),
    },
    {
      id: "actions",
      label: "Actions",
      hideable: false,
      stopRowClick: true,
      renderCell: (user) => (
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => openEditForm(user)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              setViewUser(null);
              setDeleteTarget(user);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("users", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage user accounts with credentials, roles, language, and branch access."
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => {
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
      </div>

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>User directory</CardTitle>
              <CardDescription>Search and filter users by branch, status, and role.</CardDescription>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:max-w-3xl lg:justify-end">
              <select
                aria-label="Search field"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={filters.searchField}
                onChange={(event) => {
                  setFilters((current) => ({
                    ...current,
                    searchField: event.target.value as UserFilterState["searchField"],
                  }));
                  setPage(1);
                }}
              >
                {USER_SEARCH_FIELDS.map((option) => (
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
                    searchOperator: event.target.value as UserFilterState["searchOperator"],
                  }));
                  setPage(1);
                }}
              >
                {USER_SEARCH_OPERATORS.map((option) => (
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
                  placeholder="Search users..."
                />
              </div>
              <ColumnVisibilityMenu columnLayout={columnVisibility} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Branch</span>
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            {statusFilters.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={filters.status === option.value ? "default" : "outline"}
                onClick={() => {
                  setFilters((current) => ({ ...current, status: option.value }));
                  setPage(1);
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</span>
            {roleFilters.map((option) => (
              <Button
                key={String(option.value)}
                type="button"
                size="sm"
                variant={filters.roleId === option.value ? "default" : "outline"}
                onClick={() => {
                  setFilters((current) => ({ ...current, roleId: option.value }));
                  setPage(1);
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
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
                onClick={() => setDeleteTarget(users.filter((user) => selectedIds.includes(user.userId)))}
              >
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading users…</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageUsers}
            rowKey={(user) => user.userId}
            rowLabel={(user) => user.username}
            columnLayout={columnVisibility}
            minWidth={1700}
            selectable
            selectedIds={selectedIds}
            allPageSelected={allPageSelected}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelect={toggleSelect}
            onRowClick={setViewUser}
            emptyState={
              <>
                <p className="text-muted-foreground">No users match your search or filters.</p>
                <Button className="mt-4" onClick={openAddForm}>
                  <Plus className="h-4 w-4" />
                  Add user
                </Button>
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {isFetching ? "Refreshing…" : `Showing ${pageUsers.length} of ${totalUsers} users`}
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

      <UserViewSheet
        user={viewUser}
        open={Boolean(viewUser)}
        onOpenChange={(open) => {
          if (!open) setViewUser(null);
        }}
        onEdit={openEditForm}
        onDelete={(user) => {
          setViewUser(null);
          setDeleteTarget(user);
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit user" : "Add user"}</DialogTitle>
            <DialogDescription>
              Set login credentials, role, language preference, and branch access.
            </DialogDescription>
          </DialogHeader>
          <UserForm
            key={editingUser?.userId ?? "new"}
            initialValues={
              formMode === "edit" && editingUser ? userToFormValues(editingUser) : createEmptyUserForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingUser?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add user"}
            isSubmitting={isSaving}
            onSubmit={saveUser}
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
            <DialogTitle>Delete user{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected users.`
                : "This will permanently remove this user account. This action cannot be undone."}
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
