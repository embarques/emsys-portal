"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Shield,
  UserX,
  UserCog,
  Users,
} from "lucide-react";

import { UserForm } from "@/components/users/user-form";
import { UserViewSheet } from "@/components/users/user-view-sheet";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
} from "@/components/app-shell/table-directory-toolbar";
import { USER_TABLE_FILTER_FIELDS } from "@/lib/users/filter-fields";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { useTableSort } from "@/lib/table/use-table-sort";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDateTime } from "@/lib/audit/display";
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
  useDeactivateUser,
  useUsers,
  useUserStats,
  useUpdateUser,
} from "@/lib/users/hooks/use-users";
import { createSecondaryFirebaseUser } from "@/lib/auth/firebase/firebase-user-admin";
import {
  DEFAULT_USER_LIST_PARAMS,
  buildUserListParams,
  createEmptyUserForm,
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
  const { notifyAdded, notifyUpdated } = useFeedback();
  const [filters, setFilters] = useState<UserFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(filters.query, SEARCH_DEBOUNCE_MS);
  const isSearchPending = filters.query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const { sort, onSortChange } = useTableSort(DEFAULT_USER_LIST_PARAMS.sort, () => setPage(1));
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<User | User[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () =>
      buildUserListParams({
        page,
        limit: PAGE_SIZE,
        query: debouncedQuery,
        rows: filters.rows,
        sort,
      }),
    [debouncedQuery, filters.rows, page, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useUsers(listParams);
  const { data: branchesData, isLoading: branchesLoading } = useBranchPicker(200, {
    enabled: filtersOpen,
  });
  const stats = useUserStats();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deactivateUserMutation = useDeactivateUser();

  const users = data?.items ?? [];
  const totalUsers = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = users;
  const allPageSelected =
    pageUsers.length > 0 && pageUsers.every((user) => selectedIds.includes(String(user.id)));
  const isSaving =
    createUserMutation.isPending || updateUserMutation.isPending || deactivateUserMutation.isPending;

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

  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();

  function openAddForm() {
    if (isDesktopTabs) {
      openFormTab({ feature: "users", baseHref: "/users", mode: "add", label: "Add user" });
      return;
    }
    setEditingUser(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(user: User) {
    if (isDesktopTabs) {
      setViewUser(null);
      openFormTab({
        feature: "users",
        baseHref: "/users",
        mode: "edit",
        entityId: String(user.id),
        label: `Edit ${user.name}`,
      });
      return;
    }
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
        notifyUpdated("User", nextUser.name);
      } else {
        const uid = await createSecondaryFirebaseUser(values.email, values.password);
        try {
          const nextUser = await createUserMutation.mutateAsync({ values, uid });
          notifyAdded("User", nextUser.name);
        } catch (apiError) {
          throw new Error(
            `The Firebase account was created, but the EMSYS tenant user record was not created. Do not submit this form again with the same email. ${normalizeApiError(apiError).message}`,
          );
        }
      }

      setFormMode(null);
      setEditingUser(null);
      setPage(1);
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    const targets = Array.isArray(deactivateTarget) ? deactivateTarget : [deactivateTarget];

    try {
      await Promise.all(targets.map((user) => deactivateUserMutation.mutateAsync(user)));
      setSelectedIds((current) => current.filter((id) => !targets.map((user) => String(user.id)).includes(id)));
      setDeactivateTarget(null);
      setViewUser(null);
      notifyUpdated(targets.length === 1 ? "User" : "Users", targets.length === 1 ? targets[0].name : String(targets.length));
    } catch (mutationError) {
      setFormError(normalizeApiError(mutationError).message);
      setDeactivateTarget(null);
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
      id: "name",
      label: "name",
      cellClassName: "font-medium",
      renderCell: (user) => user.name,
    },
    {
      id: "active",
      label: "active",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (user) => (
        <TableTagText className={getUserActiveBadgeClass(user.active)}>
          {getUserActiveLabel(user.active)}
        </TableTagText>
      ),
    },
    {
      id: "role.name",
      label: "role.name",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (user) => (
        <TableTagText className={getUserRoleBadgeClass(user.role.name)}>
          {getUserRoleLabel(user.role.name)}
        </TableTagText>
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
      sortField: "branch.name",
      truncateCell: false,
      cellClassName: "overflow-visible",
      renderCell: (user) => (
        <TableTagText className={getUserBranchBadgeClass(user)}>
          {formatUserBranchLabel(user)}
        </TableTagText>
      ),
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
      id: "email",
      label: "email",
      renderCell: (user) => user.email || "—",
    },
    {
      id: "createdAt",
      label: "createdAt",
      cellClassName: "text-muted-foreground",
      renderCell: (user) => (user.createdAt ? formatAuditDateTime(user.createdAt) : "—"),
    },
    {
      id: "updatedAt",
      label: "updatedAt",
      cellClassName: "text-muted-foreground",
      renderCell: (user) => (user.updatedAt ? formatAuditDateTime(user.updatedAt) : "—"),
    },
    {
      id: "actions",
      label: "Actions",
      sortable: false,
      truncateCell: false,
      renderCell: (user) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={(event) => event.stopPropagation()} aria-label={`Actions for ${user.name}`}>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem onClick={() => openEditForm(user)}>Edit user</DropdownMenuItem>
            {user.active ? <DropdownMenuItem className="text-destructive" onClick={() => setDeactivateTarget(user)}>Deactivate user</DropdownMenuItem> : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
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
                placeholder="Search users..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${pageUsers.length} of ${totalUsers} users`}
                presets={{
                  storageKey: "users",
                  rows: filters.rows,
                  fields: USER_TABLE_FILTER_FIELDS,
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

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={pageUsers.map((user) => String(user.id))}
          totalCount={totalUsers}
          onSelectedIdsChange={setSelectedIds}
          onEdit={() => {
            const user = pageUsers.find((entry) => String(entry.id) === selectedIds[0]);
            if (user) openEditForm(user);
          }}
          onDelete={() => setDeactivateTarget(users.filter((user) => selectedIds.includes(String(user.id))))}
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
            rowLabel={(user) => user.name}
            columnLayout={columnVisibility}
        minWidth={1600}
            sort={sort}
            onSortChange={onSortChange}
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
          setDeactivateTarget(user);
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

      <Dialog open={deactivateTarget !== null} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>Deactivate user{Array.isArray(deactivateTarget) && deactivateTarget.length > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              {Array.isArray(deactivateTarget)
                ? `This will prevent ${deactivateTarget.length} selected users from accessing this company.`
                : `${deactivateTarget?.name ?? "This user"} will no longer be able to access this company.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeactivate} disabled={isSaving}>
              <UserX className="h-4 w-4" />
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
