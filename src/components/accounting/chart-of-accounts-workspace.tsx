"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { ChartAccountForm } from "@/components/accounting/chart-account-form";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import {
  useChartAccounts,
  useCreateChartAccount,
  useDeleteChartAccount,
  useUpdateChartAccount,
} from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import type {
  ChartAccount,
  ChartAccountType,
  ChartAccountValues,
} from "@/lib/accounting/chart-accounts/types";
import { normalizeApiError } from "@/lib/api/axios";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useTranslation } from "@/lib/i18n";
import {
  buildTableSelectionResetKey,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import {
  buildToolbarSearchSummary,
  formatPaginatedListSummary,
} from "@/lib/table/list-summary";
import type { DataTableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 40;
const EMPTY_ACCOUNT: ChartAccountValues = {
  displayName: "",
  type: "ASSET",
  description: "",
};
const ACCOUNT_TYPES: ChartAccountType[] = [
  "ASSET",
  "EXPENSE",
  "REVENUE",
  "BANK",
  "LOAN",
];

function accountValues(account: ChartAccount): ChartAccountValues {
  return {
    displayName: account.displayName,
    type: account.type,
    description: account.description,
    branchId: account.branch?.id,
    branchCode: account.branch?.code,
    parentAccountId: account.parentAccount?.id,
    parentAccountName:
      account.parentAccount?.displayName ?? account.parentAccount?.name,
  };
}

function chartAccountTypeBadgeClassName(type: ChartAccountType) {
  switch (type) {
    case "ASSET":
      return "border-transparent bg-blue-100 text-blue-700";
    case "EXPENSE":
      return "border-transparent bg-rose-100 text-rose-700";
    case "REVENUE":
      return "border-transparent bg-emerald-100 text-emerald-700";
    case "BANK":
      return "border-transparent bg-cyan-100 text-cyan-700";
    case "LOAN":
      return "border-transparent bg-amber-100 text-amber-700";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

function MobileChartAccountRow({
  account,
  dash,
  onEdit,
  onDelete,
}: {
  account: ChartAccount;
  dash: string;
  onEdit: (account: ChartAccount) => void;
  onDelete: (account: ChartAccount) => void;
}) {
  const { t } = useTranslation();
  const branchLabel =
    account.branch?.code ?? t("accounting.chartOfAccounts.values.allBranches");
  const parentLabel =
    account.parentAccount?.displayName ?? account.parentAccount?.name ?? dash;
  const canDelete = !account.systemAccount;
  const metaParts = [
    parentLabel !== dash ? parentLabel : null,
    account.description || null,
  ].filter((value): value is string => Boolean(value));

  return (
    <article className="border-b border-border/80 py-5 last:border-b-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold leading-tight text-foreground">
            {account.displayName}
            <span className="font-semibold text-muted-foreground">
              {" "}
              ({branchLabel})
            </span>
          </h2>
          <p className="mt-2 text-base text-muted-foreground">#{account.id}</p>
          <p className="mt-2 line-clamp-2 text-base leading-relaxed text-muted-foreground">
            {metaParts.length > 0 ? metaParts.join(" - ") : dash}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Badge
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              chartAccountTypeBadgeClassName(account.type),
            )}
          >
            {t(`accounting.chartOfAccounts.types.${account.type}`)}
          </Badge>
          {account.systemAccount ? (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              {t("accounting.chartOfAccounts.values.systemAccount")}
            </p>
          ) : account.default ? (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              {t("accounting.chartOfAccounts.values.defaultAccount")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl"
          onClick={() => onEdit(account)}
        >
          <Edit className="size-4" />
          {t("common.actions.edit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl text-destructive"
          disabled={!canDelete}
          onClick={() => onDelete(account)}
        >
          <Trash2 className="size-4" />
          {t("common.actions.delete")}
        </Button>
      </div>
    </article>
  );
}

export function ChartOfAccountsWorkspace() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const isMobileViewport = useIsMobileViewport();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [mobileTypeFilter, setMobileTypeFilter] = useState<
    ChartAccountType | ""
  >("");
  const deferredQuery = useDeferredValue(query);
  const hasActiveSearch = Boolean(query.trim());
  const isSearchPending = query.trim() !== deferredQuery.trim();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChartAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChartAccount | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const activeTypeFilter = isMobileViewport ? mobileTypeFilter : "";
  const hasActiveFilters = hasActiveSearch || Boolean(activeTypeFilter);
  const accountsQuery = useChartAccounts({
    page,
    limit: PAGE_SIZE,
    query: deferredQuery,
    type: activeTypeFilter || undefined,
  });
  const accountOptionsQuery = useChartAccounts(
    { page: 1, limit: 500 },
    dialogOpen,
  );
  const branchesQuery = useBranchPicker(200);
  const createMutation = useCreateChartAccount();
  const updateMutation = useUpdateChartAccount();
  const deleteMutation = useDeleteChartAccount();
  const rows = accountsQuery.data?.items ?? [];
  const total = accountsQuery.data?.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const noun = t("accounting.chartOfAccounts.noun");
  const dash = t("common.empty.dash");
  const typeFilterOptions = useMemo(
    () => [
      { value: "", label: t("accounting.chartOfAccounts.mobile.allTypes") },
      ...ACCOUNT_TYPES.map((type) => ({
        value: type,
        label: t(`accounting.chartOfAccounts.types.${type}`),
      })),
    ],
    [t],
  );

  useTableSelectionReset(
    buildTableSelectionResetKey(deferredQuery, activeTypeFilter, page),
    setSelectedIds,
  );

  const allPageSelected =
    rows.length > 0 &&
    rows.every((account) => selectedIds.includes(String(account.id)));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(
          new Set([...current, ...rows.map((account) => String(account.id))]),
        ),
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter(
        (id) => !rows.some((account) => String(account.id) === id),
      ),
    );
  }

  function toggleSelect(accountId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked
        ? [...current, accountId]
        : current.filter((entry) => entry !== accountId),
    );
  }

  const selectedAccount = rows.find(
    (account) => String(account.id) === selectedIds[0],
  );
  const deleteDisabled =
    selectedIds.length !== 1 || Boolean(selectedAccount?.systemAccount);

  const columns: DataTableColumn<ChartAccount>[] = useMemo(
    () => [
      {
        id: "id",
        label: t("accounting.chartOfAccounts.columns.id"),
        renderCell: (account) => account.id,
      },
      {
        id: "type",
        label: t("accounting.chartOfAccounts.columns.type"),
        truncateCell: false,
        renderCell: (account) => (
          <TableTagText>
            {t(`accounting.chartOfAccounts.types.${account.type}`)}
          </TableTagText>
        ),
      },
      {
        id: "displayName",
        label: t("accounting.chartOfAccounts.columns.displayName"),
        cellClassName: "font-medium",
        renderCell: (account) => account.displayName,
      },
      {
        id: "branch",
        label: t("accounting.chartOfAccounts.columns.branch"),
        renderCell: (account) =>
          account.branch?.code ??
          t("accounting.chartOfAccounts.values.allBranches"),
      },
      {
        id: "parent",
        label: t("accounting.chartOfAccounts.columns.parent"),
        renderCell: (account) =>
          account.parentAccount?.displayName ??
          account.parentAccount?.name ??
          dash,
      },
      {
        id: "description",
        label: t("accounting.chartOfAccounts.columns.description"),
        renderCell: (account) => account.description || dash,
      },
      {
        id: "system",
        label: t("accounting.chartOfAccounts.columns.system"),
        truncateCell: false,
        renderCell: (account) =>
          account.systemAccount ? (
            <TableTagText>
              {t("accounting.chartOfAccounts.values.systemAccount")}
            </TableTagText>
          ) : (
            dash
          ),
      },
    ],
    [dash, t],
  );
  const columnLayout = useColumnVisibility("chart-of-accounts-v1", columns);

  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveFilters,
      query,
      isSearchPending,
      matched: total,
      noun,
      isLoading: accountsQuery.isFetching && rows.length === 0,
    },
    t,
  );

  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: rows.length,
      page,
      pageSize: PAGE_SIZE,
      total,
      noun,
      isFiltered: hasActiveFilters,
      isLoading: accountsQuery.isFetching,
    },
    t,
  );

  function save(values: ChartAccountValues) {
    setFormError(null);
    if (editing && areFormValuesEquivalent(values, accountValues(editing))) {
      setDialogOpen(false);
      setEditing(null);
      feedback.notifySuccess(t("common.form.noChanges"));
      return;
    }
    const action = editing
      ? updateMutation.mutateAsync({ id: editing.id, values })
      : createMutation.mutateAsync(values);
    action
      .then(() => {
        setDialogOpen(false);
        setEditing(null);
        feedback.notifySuccess(
          editing
            ? t("accounting.chartOfAccounts.toasts.updated")
            : t("accounting.chartOfAccounts.toasts.created"),
        );
      })
      .catch((error) => setFormError(normalizeApiError(error).message));
  }

  function openCreateDialog() {
    setEditing(null);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(account: ChartAccount) {
    setEditing(account);
    setFormError(null);
    setDialogOpen(true);
  }

  return (
    <div className="overflow-x-hidden">
      <section className="space-y-5 md:hidden">
        <div className="space-y-4">
          <div>
            <h1 className="text-4xl font-bold tracking-normal">
              {t("accounting.chartOfAccounts.title")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{listSummary}</p>
          </div>

          <Button
            className="h-12 w-full rounded-xl text-base"
            onClick={openCreateDialog}
          >
            <Plus className="size-5" />
            {t("accounting.chartOfAccounts.addAccount")}
          </Button>
        </div>

        <div className="rounded-3xl border bg-card p-4 shadow-sm">
        <div className="grid gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground/80" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              className="h-12 w-full rounded-xl border border-border/70 bg-card pl-12 pr-4 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              placeholder={t("accounting.chartOfAccounts.searchPlaceholder")}
              aria-label={t("accounting.chartOfAccounts.searchPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chart-account-type-mobile">
              {t("accounting.chartOfAccounts.form.fields.type")}
            </Label>
            <SearchableSelect
              id="chart-account-type-mobile"
              value={mobileTypeFilter}
              onValueChange={(next) => {
                setMobileTypeFilter(next as ChartAccountType | "");
                setPage(1);
              }}
              options={typeFilterOptions}
              placeholder={t("accounting.chartOfAccounts.mobile.allTypes")}
              searchable={false}
              mobileSheet
              className="min-h-12 rounded-xl border-border bg-card text-base"
            />
          </div>
        </div>
        </div>

        {!accountsQuery.isLoading && !accountsQuery.isError ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="size-4" />
              {t("common.actions.previous")}
            </Button>
            <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
              {t("common.pagination.pageOf", {
                current: page,
                total: totalPages,
              })}
            </span>
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              disabled={page >= totalPages}
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
            >
              {t("common.actions.next")}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}

        <div className="rounded-3xl bg-card px-4 shadow-sm">
          {accountsQuery.isError ? (
            <div className="py-8 text-sm text-destructive">
              {normalizeApiError(accountsQuery.error).message}
            </div>
          ) : accountsQuery.isLoading ? (
            <div className="space-y-4 py-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="border-b border-border/80 py-3 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="h-5 w-44 rounded bg-muted" />
                      <div className="h-4 w-16 rounded bg-muted" />
                    </div>
                    <div className="h-7 w-20 rounded-full bg-muted" />
                  </div>
                  <div className="mt-4 h-4 w-full rounded bg-muted" />
                  <div className="mt-2 h-4 w-3/4 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("accounting.chartOfAccounts.empty")}
            </p>
          ) : (
            rows.map((account) => (
              <MobileChartAccountRow
                key={account.id}
                account={account}
                dash={dash}
                onEdit={openEditDialog}
                onDelete={setDeleteTarget}
              />
            ))
          )}
        </div>
      </section>

      <div className="hidden md:block">
        <PageHeader
          title={t("accounting.chartOfAccounts.title")}
          description={t("accounting.chartOfAccounts.description")}
          actions={
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t("accounting.chartOfAccounts.addAccount")}
            </Button>
          }
        />

        <Card className="mt-6 gap-0">
          <CardHeader className="gap-3 border-b py-4 pb-3">
            <div>
              <CardTitle>
                {t("accounting.chartOfAccounts.card.title")}
              </CardTitle>
              <CardDescription>
                {t("accounting.chartOfAccounts.card.description")}
              </CardDescription>
            </div>
            <TableDirectoryToolbar
              showFilterToggle={false}
              columnLayout={columnLayout}
              searchSummary={searchSummary}
              search={
                <TableSearchInput
                  value={query}
                  onChange={(value) => {
                    setQuery(value);
                    setPage(1);
                  }}
                  placeholder={t(
                    "accounting.chartOfAccounts.searchPlaceholder",
                  )}
                />
              }
            />
          </CardHeader>

          {accountsQuery.isError ? (
            <div className="border-b px-6 py-3 text-sm text-destructive">
              {normalizeApiError(accountsQuery.error).message}
            </div>
          ) : accountsQuery.isLoading ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              {t("accounting.chartOfAccounts.loading")}
            </div>
          ) : (
            <>
              <TableSelectionToolbar
                selectedIds={selectedIds}
                pageRowIds={rows.map((account) => String(account.id))}
                totalCount={total}
                onSelectedIdsChange={setSelectedIds}
                onEdit={() => {
                  if (!selectedAccount) return;
                  openEditDialog(selectedAccount);
                }}
                onDelete={() => {
                  if (!selectedAccount) return;
                  setDeleteTarget(selectedAccount);
                }}
                deleteDisabled={deleteDisabled}
              />
              <DataTable
                columns={columnLayout.columns}
                rows={rows}
                page={page}
                isPageDataPending={accountsQuery.isFetching}
                rowKey={(account) => String(account.id)}
                rowLabel={(account) => account.displayName}
                columnLayout={columnLayout}
                minWidth={1100}
                selectable
                selectedIds={selectedIds}
                allPageSelected={allPageSelected}
                onToggleSelectAll={toggleSelectAll}
                onToggleSelect={toggleSelect}
                emptyState={
                  <p className="text-muted-foreground">
                    {t("accounting.chartOfAccounts.empty")}
                  </p>
                }
              />
            </>
          )}

          {!accountsQuery.isLoading && !accountsQuery.isError ? (
            <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">{listSummary}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("common.actions.previous")}
                </Button>
                <span className="px-2 text-sm text-muted-foreground">
                  {t("common.pagination.pageOf", {
                    current: page,
                    total: totalPages,
                  })}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() =>
                    setPage((value) => Math.min(totalPages, value + 1))
                  }
                >
                  {t("common.actions.next")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditing(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="inset-x-0 top-0 flex h-[100dvh] max-h-[100dvh] w-[100dvw] max-w-[100dvw] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 max-md:[&>button.absolute]:hidden sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:p-6">
          <DialogHeader className="shrink-0 border-b border-primary/20 bg-primary px-4 pb-4 pt-5 text-primary-foreground sm:border-b-0 sm:bg-transparent sm:p-0 sm:text-foreground">
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-2xl font-bold text-primary-foreground sm:text-lg sm:text-foreground">
                {editing
                  ? t("accounting.chartOfAccounts.form.editTitle")
                  : t("accounting.chartOfAccounts.form.createTitle")}
              </DialogTitle>
              <button type="button" className="font-semibold text-primary-foreground sm:hidden" onClick={() => setDialogOpen(false)}>
                {t("common.actions.cancel")}
              </button>
            </div>
            <DialogDescription className="text-primary-foreground/85 sm:text-muted-foreground">
              {editing
                ? t("accounting.chartOfAccounts.form.editDescription")
                : t("accounting.chartOfAccounts.form.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:overflow-visible sm:p-0">
            <ChartAccountForm
              key={editing?.id ?? "new"}
              initialValues={editing ? accountValues(editing) : EMPTY_ACCOUNT}
              branches={branchesQuery.data?.items ?? []}
              accounts={(accountOptionsQuery.data?.items ?? []).filter(
                (account) => account.id !== editing?.id,
              )}
              isEditing={Boolean(editing)}
              isSubmitting={
                createMutation.isPending || updateMutation.isPending
              }
              error={formError}
              onSubmit={save}
              onCancel={() => setDialogOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("accounting.chartOfAccounts.delete.title")}
            </DialogTitle>
            <DialogDescription>
              {t("accounting.chartOfAccounts.delete.description", {
                name: deleteTarget?.displayName ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteMutation
                  .mutateAsync(deleteTarget.id)
                  .then(() => {
                    setDeleteTarget(null);
                    feedback.notifyDeleted(
                      t("accounting.chartOfAccounts.entity"),
                      1,
                    );
                  })
                  .catch((error) =>
                    feedback.notifyError(normalizeApiError(error).message),
                  );
              }}
            >
              {t("common.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
