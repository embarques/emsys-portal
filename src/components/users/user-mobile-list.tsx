"use client";

import { ChevronLeft, ChevronRight, Filter, Plus, Users } from "lucide-react";
import type { ReactNode } from "react";

import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { UserMobileRow } from "@/components/users/user-mobile-row";
import { UserMobileSelectionToolbar } from "@/components/users/user-mobile-selection-toolbar";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/users/types";
import { useTranslation } from "@/lib/i18n";

type UserMobileListProps = {
  query: string;
  users: User[];
  selectedIds: string[];
  isLoading: boolean;
  isFetching: boolean;
  isSaving: boolean;
  listErrorMessage: string | null;
  emptyMessage: string;
  page: number;
  totalPages: number;
  activeFilterCount: number;
  filtersOpen: boolean;
  filterPanel: ReactNode;
  onFiltersOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onOpen: (user: User) => void;
  onEdit: (user: User) => void;
  onDeactivate: (user: User | User[]) => void;
  onSelectedIdsChange: (ids: string[]) => void;
  onAddUser: () => void;
};

export function UserMobileList({
  query,
  users,
  selectedIds,
  isLoading,
  isFetching,
  isSaving,
  listErrorMessage,
  emptyMessage,
  page,
  totalPages,
  activeFilterCount,
  filtersOpen,
  filterPanel,
  onFiltersOpenChange,
  onQueryChange,
  onPageChange,
  onOpen,
  onEdit,
  onDeactivate,
  onSelectedIdsChange,
  onAddUser,
}: UserMobileListProps) {
  const { t } = useTranslation();
  const selectedUsers = users.filter((user) => selectedIds.includes(String(user.id)));
  const selectionMode = selectedIds.length > 0;

  function toggleSelected(userId: string, checked: boolean) {
    onSelectedIdsChange(checked ? [...selectedIds, userId] : selectedIds.filter((id) => id !== userId));
  }

  return (
    <section className="space-y-5 overflow-x-hidden md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold tracking-normal text-foreground">{t("users.title")}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t("users.pages.description")}</p>
        </div>
        <Button type="button" size="icon" className="size-12 shrink-0 rounded-2xl" disabled={isSaving} onClick={onAddUser}>
          <Plus className="size-6" />
          <span className="sr-only">{t("users.actions.add")}</span>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <TableSearchInput
          value={query}
          onChange={(value) => {
            onQueryChange(value);
            onPageChange(1);
          }}
          placeholder={t("users.search.placeholder")}
          className="flex-1"
          inputClassName="h-14 rounded-2xl text-base"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative size-14 shrink-0 rounded-full"
          onClick={() => onFiltersOpenChange(!filtersOpen)}
        >
          <Filter className="size-6 text-primary" />
          {activeFilterCount > 0 ? (
            <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
          <span className="sr-only">{t("common.table.filter")}</span>
        </Button>
      </div>

      {filtersOpen ? <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">{filterPanel}</div> : null}

      <UserMobileSelectionToolbar
        selectedCount={selectedIds.length}
        canEdit={selectedIds.length === 1}
        disabled={isSaving}
        onClear={() => onSelectedIdsChange([])}
        onEdit={() => {
          const user = selectedUsers[0];
          if (user) onEdit(user);
        }}
        onDeactivate={() => onDeactivate(selectedUsers)}
      />

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl"
          disabled={page <= 1 || isLoading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="size-4" />
          {t("common.actions.previous")}
        </Button>
        <p className="text-sm font-medium text-muted-foreground">
          {t("common.pagination.pageOf", { current: page, total: totalPages })}
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl"
          disabled={page >= totalPages || isLoading}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          {t("common.actions.next")}
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="rounded-3xl border border-border bg-card px-4 shadow-sm">
        {listErrorMessage ? (
          <p className="py-6 text-center text-sm text-destructive">{listErrorMessage}</p>
        ) : isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Users className="mx-auto mb-3 size-8 animate-pulse text-primary" />
            {t("users.loading.list")}
          </div>
        ) : users.length > 0 ? (
          <>
            {isFetching ? <p className="border-b py-3 text-center text-xs text-muted-foreground">{t("common.loading")}</p> : null}
            {users.map((user) => (
              <UserMobileRow
                key={user.id}
                user={user}
                selected={selectedIds.includes(String(user.id))}
                selectionMode={selectionMode}
                onOpen={onOpen}
                onEdit={onEdit}
                onDeactivate={onDeactivate}
                onToggleSelected={toggleSelected}
              />
            ))}
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">{emptyMessage}</p>
            <Button className="mt-4 h-12 rounded-xl" onClick={onAddUser}>
              <Plus className="size-4" />
              {t("users.actions.add")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
