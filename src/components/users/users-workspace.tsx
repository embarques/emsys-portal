"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Shield,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";

import { UserForm } from "@/components/users/user-form";
import { UserViewSheet } from "@/components/users/user-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { UniformWidthPill } from "@/components/app-shell/uniform-width-pill";
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
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { USER_TABLE_FILTER_FIELDS } from "@/lib/users/filter-fields";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDate } from "@/lib/audit/display";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import type { DataTableColumn } from "@/lib/table/types";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
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
  buildUserListParams,
  createEmptyUserForm,
  maskPassword,
  userToFormValues,
  type User,
  type UserFilterState,
  type UserFormValues,
} from "@/lib/users/types";

const PAGE_SIZE = DEFAULT_USER_LIST_PARAMS.limit;
const SEARCH_DEBOUNCE_MS = 300;

const defaultFilters: UserFilterState = {
  query: "",
  rows: [],
};

export function UsersWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [filters, setFilters] = useState<UserFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | User[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () =>
      buildUserListParams({
        page,
        limit: PAGE_SIZE,
        query: debouncedQuery,
        rows: filters.rows,
      }),
    [debouncedQuery, filters.rows, page],
  );

  const { data, isLoading, isError, error, isFetching } = useUsers(listParams);
  const { data: branchesData, isLoading: branchesLoading } = useBranchPicker(200, {
    enabled: filtersOpen,
  });
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

  const branchFilterOptions = useMemo(() => {
    const apiBranches = branchesData?.items ?? [];

    return apiBranches.map((branch) => ({
      value: String(branch.id),
      label: formatBranchFilterLabel(branch),
    }));
  }, [branchesData?.items]);

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
      label: "User ID",
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
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (user) => (
        <UniformWidthPill columnKey="active">
          <Badge className={getUserActiveBadgeClass(user.active)}>{getUserActiveLabel(user.active)}</Badge>
        </UniformWidthPill>
      ),
    },
    {
      id: "role.name",
      label: "role.name",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (user) => (
        <UniformWidthPill columnKey="role.name">
          <Badge className={getUserRoleBadgeClass(user.role.name)}>{getUserRoleLabel(user.role.name)}</Badge>
        </UniformWidthPill>
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
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (user) => (
        <UniformWidthPill columnKey="branch">
          <Badge className={getUserBranchBadgeClass(user)}>{formatUserBranchLabel(user)}</Badge>
        </UniformWidthPill>
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
  ];

  const columnVisibility = useColumnVisibility("users", tableColumns);
  const listErrorMessage = isError ? normalizeApiError(error).message : null;
  const activeFilterCount = countCompleteFilterRows(filters.rows, USER_TABLE_FILTER_FIELDS);
  const hasActiveFilters = Boolean(filters.query.trim()) || activeFilterCount > 0;
  const searchSummary = buildToolbarSearchSummary({
    isFiltered: hasActiveFilters,
    query: filters.query,
    isSearchPending,
    matched: totalUsers,
    catalogTotal: stats.total,
    noun: "users",
    isLoading: isFetching && users.length === 0,
    catalogLoading: stats.isLoading,
  });

  return (
    <div>
      <PageHeader
        title="Users"
        actions={
          <Button onClick={openAddForm} disabled={isSaving}>
            <Plus className="h-4 w-4" />
            Add user
          </Button>
        }
      />

      <StatCardsGrid>
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
      </StatCardsGrid>

      <Card className="mt-6">
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
                placeholder="Search users..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${pageUsers.length} of ${totalUsers} users`}
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
                  fields={USER_TABLE_FILTER_FIELDS}
                  dynamicOptions={{
                    branches: branchesLoading ? [] : branchFilterOptions,
                  }}
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

        <TableSelectionBar
          selectedIds={selectedIds}
          pageRowIds={pageUsers.map((user) => String(user.id))}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const user = pageUsers.find((entry) => String(entry.id) === selectedIds[0]);
            if (user) openEditForm(user);
          }}
          onDelete={() => setDeleteTarget(users.filter((user) => selectedIds.includes(String(user.id))))}
          deleteDisabled={isSaving}
        />

        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading users…</div>
        ) : (
          <DataTable
            columns={columnVisibility.columns}
            rows={pageUsers}
            page={currentPage}
            isPageDataPending={isFetching}
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
            onRowDoubleClick={openEditForm}
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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{formMode === "edit" ? "Edit user" : "Add user"}</DialogTitle>
          </DialogHeader>
          <UserForm
            key={editingUser?.id ?? "new"}
            initialValues={
              formMode === "edit" && editingUser ? userToFormValues(editingUser) : createEmptyUserForm()
            }
            isEditing={formMode === "edit"}
            submitLabel={formMode === "edit" ? "Save changes" : "Add user"}
            isSubmitting={isSaving}
            externalError={formError}
            onSubmit={saveUser}
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
