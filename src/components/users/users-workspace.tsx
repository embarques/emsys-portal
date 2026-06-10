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
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import type { DataTableColumn } from "@/lib/table/types";
import {
  formatUserBranchLabel,
  getUserActiveBadgeClass,
  getUserActiveLabel,
  getUserBranchBadgeClass,
  getUserRoleBadgeClass,
  getUserRoleLabel,
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
  DEFAULT_USER_LIST_PARAMS,
  USER_ROLE_OPTIONS,
  USER_SEARCH_FIELDS,
  createEmptyUserForm,
  createUserSearchFilter,
  getDefaultUserSearchOperator,
  getUserSearchOperatorsForField,
  getUserSearchSort,
  maskPassword,
  userToFormValues,
  type User,
  type UserFilterState,
  type UserFormValues,
} from "@/lib/users/types";

const PAGE_SIZE = DEFAULT_USER_LIST_PARAMS.limit;

const defaultFilters: UserFilterState = {
  query: "",
  searchField: "userName",
  searchOperator: "startsWith",
  branch: "all",
  active: "all",
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
        ...DEFAULT_USER_LIST_PARAMS,
        page,
        limit: PAGE_SIZE,
        sort: search ? getUserSearchSort(filters.searchField) : DEFAULT_USER_LIST_PARAMS.sort,
        search,
        branch: filters.branch,
        active: filters.active,
        roleId: filters.roleId,
      };
    },
    [
      deferredQuery,
      filters.active,
      filters.branch,
      filters.roleId,
      filters.searchField,
      filters.searchOperator,
      page,
    ],
  );

  const { data, isLoading, isError, error, isFetching } = useUsers(listParams);
  const { data: branchesData } = useBranchPicker();
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
    pageUsers.length > 0 && pageUsers.every((user) => selectedIds.includes(String(user.id)));
  const isSaving =
    createUserMutation.isPending || updateUserMutation.isPending || deleteUsersMutation.isPending;

  const roleFilters = useMemo(() => {
    const discoveredRoles = new Map<number, string>();
    for (const user of users) {
      if (user.role.id > 0) {
        discoveredRoles.set(user.role.id, user.role.name || `Role ${user.role.id}`);
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

  const branchFilters = useMemo(() => {
    const apiBranches = branchesData?.items ?? [];

    return [
      { value: "all" as const, label: "All branches" },
      ...apiBranches.map((branch) => ({
        value: branch.id,
        label: formatBranchFilterLabel(branch),
      })),
    ];
  }, [branchesData?.items]);

  const activeFilters: { value: UserFilterState["active"]; label: string }[] = [
    { value: "all", label: "All" },
    { value: true, label: "Active" },
    { value: false, label: "Inactive" },
  ];

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...users.map((user) => String(user.id))])),
      );
      return;
    }
    setSelectedIds((current) => current.filter((id) => !users.some((user) => String(user.id) === id)));
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
          userId: editingUser.id,
          values,
        });
        notifyUpdated("User", nextUser.userName);
      } else {
        const nextUser = await createUserMutation.mutateAsync(values);
        notifyAdded("User", nextUser.userName);
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
      ? deleteTarget.map((user) => user.id)
      : [deleteTarget.id];

    try {
      await deleteUsersMutation.mutateAsync(ids);
      setSelectedIds((current) => current.filter((id) => !ids.map(String).includes(id)));
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

  const tableColumns: DataTableColumn<User>[] = [
    {
      id: "id",
      label: "id",
      cellClassName: "font-mono text-xs",
      renderCell: (user) => truncateUserId(user.id),
    },
    {
      id: "uid",
      label: "uid",
      cellClassName: "font-mono text-xs text-muted-foreground",
      renderCell: (user) => (user.uid ? truncateUid(user.uid) : "—"),
    },
    {
      id: "userName",
      label: "userName",
      cellClassName: "font-medium",
      renderCell: (user) => user.userName,
    },
    {
      id: "fullName",
      label: "fullName",
      renderCell: (user) => user.fullName || "—",
    },
    {
      id: "password",
      label: "password",
      cellClassName: "font-mono text-muted-foreground",
      renderCell: (user) => maskPassword(user.password),
    },
    {
      id: "active",
      label: "active",
      renderCell: (user) => (
        <Badge className={getUserActiveBadgeClass(user.active)}>{getUserActiveLabel(user.active)}</Badge>
      ),
    },
    {
      id: "role.name",
      label: "role.name",
      renderCell: (user) => (
        <Badge className={getUserRoleBadgeClass(user.role.name)}>{getUserRoleLabel(user.role.name)}</Badge>
      ),
    },
    {
      id: "role.id",
      label: "role.id",
      cellClassName: "font-mono text-xs",
      renderCell: (user) => (user.role.id > 0 ? String(user.role.id) : "—"),
    },
    {
      id: "branch",
      label: "branch",
      renderCell: (user) => (
        <Badge className={getUserBranchBadgeClass(user)}>{formatUserBranchLabel(user)}</Badge>
      ),
    },
    {
      id: "branch.code",
      label: "branch.code",
      renderCell: (user) => user.branch.code || "—",
    },
    {
      id: "branch.name",
      label: "branch.name",
      renderCell: (user) => user.branch.name || "—",
    },
    {
      id: "startTime",
      label: "startTime",
      renderCell: (user) => user.startTime || "—",
    },
    {
      id: "endTime",
      label: "endTime",
      renderCell: (user) => user.endTime || "—",
    },
    {
      id: "type",
      label: "type",
      renderCell: (user) => user.type || "—",
    },
    {
      id: "accessCode",
      label: "accessCode",
      cellClassName: "font-mono text-xs",
      renderCell: (user) => String(user.accessCode),
    },
    {
      id: "user",
      label: "user",
      renderCell: (user) => user.user || "—",
    },
    {
      id: "email",
      label: "email",
      renderCell: (user) => user.email || "—",
    },
    {
      id: "createdAt",
      label: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (user) => (user.createdAt ? formatAuditDate(user.createdAt) : "—"),
    },
    {
      id: "updatedAt",
      label: "updatedAt",
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
  const searchOperatorOptions = useMemo(
    () =>
      getUserSearchOperatorsForField(filters.searchField).map((operator) => ({
        value: operator,
        label:
          operator === "startsWith"
            ? "Starts with"
            : operator === "contains"
              ? "Contains"
              : operator === "eq"
                ? "Equals"
                : "Not equals",
      })),
    [filters.searchField],
  );

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage user accounts with credentials, roles, branch access, and schedule windows."
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
              <CardDescription>Search and filter users by branch, active status, and role.</CardDescription>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:max-w-3xl lg:justify-end">
              <select
                aria-label="Search field"
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                value={filters.searchField}
                onChange={(event) => {
                  const searchField = event.target.value as UserFilterState["searchField"];
                  setFilters((current) => {
                    const allowedOperators = getUserSearchOperatorsForField(searchField);
                    const searchOperator = allowedOperators.includes(current.searchOperator)
                      ? current.searchOperator
                      : getDefaultUserSearchOperator(searchField);

                    return {
                      ...current,
                      searchField,
                      searchOperator,
                    };
                  });
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
                {searchOperatorOptions.map((option) => (
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
                key={String(option.value)}
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
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active</span>
            {activeFilters.map((option) => (
              <Button
                key={String(option.value)}
                type="button"
                size="sm"
                variant={filters.active === option.value ? "default" : "outline"}
                onClick={() => {
                  setFilters((current) => ({ ...current, active: option.value }));
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
                onClick={() =>
                  setDeleteTarget(users.filter((user) => selectedIds.includes(String(user.id))))
                }
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
            rowKey={(user) => String(user.id)}
            rowLabel={(user) => user.userName}
            columnLayout={columnVisibility}
            minWidth={2200}
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
              Set login credentials, role, branch access, schedule, and account metadata.
            </DialogDescription>
          </DialogHeader>
          <UserForm
            key={editingUser?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingUser ? userToFormValues(editingUser) : createEmptyUserForm()
            }
            isEditing={formMode === "edit"}
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
