"use client";

import { ChevronLeft, ChevronRight, Filter, Plus, Shield } from "lucide-react";
import type { ReactNode } from "react";

import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { RoleMobileRow } from "@/components/roles/role-mobile-row";
import { RoleMobileSelectionToolbar } from "@/components/roles/role-mobile-selection-toolbar";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/roles/types";
import { useTranslation } from "@/lib/i18n";

type RoleMobileListProps = {
  query: string;
  roles: Role[];
  selectedIds: string[];
  isLoading: boolean;
  isFetching: boolean;
  addDisabled: boolean;
  pageError: string | null;
  emptyMessage: string;
  page: number;
  totalPages: number;
  activeFilterCount: number;
  filtersOpen: boolean;
  filterPanel: ReactNode;
  onFiltersOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onPageChange: (page: number) => void;
  onOpen: (role: Role) => void;
  onEdit: (role: Role) => void;
  onDelete: (role: Role | Role[]) => void;
  onSelectedIdsChange: (ids: string[]) => void;
  onAddRole: () => void;
};

export function RoleMobileList({
  query,
  roles,
  selectedIds,
  isLoading,
  isFetching,
  addDisabled,
  pageError,
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
  onDelete,
  onSelectedIdsChange,
  onAddRole,
}: RoleMobileListProps) {
  const { t } = useTranslation();
  const selectedRoles = roles.filter((role) => selectedIds.includes(role.roleId));
  const selectionMode = selectedIds.length > 0;

  function toggleSelected(roleId: string, checked: boolean) {
    onSelectedIdsChange(checked ? [...selectedIds, roleId] : selectedIds.filter((id) => id !== roleId));
  }

  return (
    <section className="space-y-5 overflow-x-hidden md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-4xl font-bold tracking-normal text-foreground">{t("roles.title")}</h1>
          <p className="mt-1 text-base text-muted-foreground">{t("roles.pages.description")}</p>
        </div>
        <Button type="button" size="icon" className="size-12 shrink-0 rounded-2xl" disabled={addDisabled} onClick={onAddRole}>
          <Plus className="size-6" />
          <span className="sr-only">{t("roles.actions.add")}</span>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <TableSearchInput
          value={query}
          onChange={(value) => {
            onQueryChange(value);
            onPageChange(1);
          }}
          placeholder={t("roles.search.placeholder")}
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

      <RoleMobileSelectionToolbar
        selectedCount={selectedIds.length}
        canViewOrEdit={selectedIds.length === 1}
        deleteDisabled={selectedRoles.some((role) => role.systemRole)}
        onClear={() => onSelectedIdsChange([])}
        onView={() => {
          const role = selectedRoles[0];
          if (role) onOpen(role);
        }}
        onEdit={() => {
          const role = selectedRoles[0];
          if (role) onEdit(role);
        }}
        onDelete={() => onDelete(selectedRoles)}
      />

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 rounded-xl"
          disabled={page <= 1}
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
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          {t("common.actions.next")}
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="rounded-3xl border border-border bg-card px-4 shadow-sm">
        {pageError ? (
          <p className="py-6 text-center text-sm text-destructive">{pageError}</p>
        ) : isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Shield className="mx-auto mb-3 size-8 animate-pulse text-primary" />
            {t("roles.loading.list")}
          </div>
        ) : roles.length > 0 ? (
          <>
            {isFetching ? <p className="border-b py-3 text-center text-xs text-muted-foreground">{t("common.loading")}</p> : null}
            {roles.map((role) => (
              <RoleMobileRow
                key={role.roleId}
                role={role}
                selected={selectedIds.includes(role.roleId)}
                selectionMode={selectionMode}
                onOpen={onOpen}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggleSelected={toggleSelected}
              />
            ))}
          </>
        ) : (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">{emptyMessage}</p>
            <Button className="mt-4 h-12 rounded-xl" disabled={addDisabled} onClick={onAddRole}>
              <Plus className="size-4" />
              {t("roles.actions.add")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
