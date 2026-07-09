"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Edit, Plus, Trash2 } from "lucide-react";

import { ChartAccountForm } from "@/components/accounting/chart-account-form";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useChartAccounts,
  useCreateChartAccount,
  useDeleteChartAccount,
  useUpdateChartAccount,
} from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import type { ChartAccount, ChartAccountValues } from "@/lib/accounting/chart-accounts/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useTranslation } from "@/lib/i18n";
import { buildToolbarSearchSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 40;
const EMPTY_ACCOUNT: ChartAccountValues = { displayName: "", type: "ASSET", description: "" };

function accountValues(account: ChartAccount): ChartAccountValues {
  return {
    displayName: account.displayName,
    type: account.type,
    description: account.description,
    branchId: account.branch?.id,
    branchCode: account.branch?.code,
    parentAccountId: account.parentAccount?.id,
    parentAccountName: account.parentAccount?.displayName ?? account.parentAccount?.name,
  };
}

export function ChartOfAccountsWorkspace() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const hasActiveSearch = Boolean(query.trim());
  const isSearchPending = query.trim() !== deferredQuery.trim();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChartAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChartAccount | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const accountsQuery = useChartAccounts({ page, limit: PAGE_SIZE, query: deferredQuery });
  const accountOptionsQuery = useChartAccounts({ page: 1, limit: 500 }, dialogOpen);
  const branchesQuery = useBranchPicker(200);
  const createMutation = useCreateChartAccount();
  const updateMutation = useUpdateChartAccount();
  const deleteMutation = useDeleteChartAccount();
  const rows = accountsQuery.data?.items ?? [];
  const total = accountsQuery.data?.total ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const noun = t("accounting.chartOfAccounts.noun");
  const dash = t("common.empty.dash");

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
          <Badge variant="outline">{t(`accounting.chartOfAccounts.types.${account.type}`)}</Badge>
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
        renderCell: (account) => account.branch?.code ?? t("accounting.chartOfAccounts.values.allBranches"),
      },
      {
        id: "parent",
        label: t("accounting.chartOfAccounts.columns.parent"),
        renderCell: (account) =>
          account.parentAccount?.displayName ?? account.parentAccount?.name ?? dash,
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
            <Badge>{t("accounting.chartOfAccounts.values.systemAccount")}</Badge>
          ) : (
            dash
          ),
      },
      {
        id: "actions",
        label: t("accounting.chartOfAccounts.columns.actions"),
        hideable: false,
        truncateCell: false,
        renderCell: (account) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("accounting.chartOfAccounts.actions.edit")}
              onClick={() => {
                setEditing(account);
                setFormError(null);
                setDialogOpen(true);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("accounting.chartOfAccounts.actions.delete")}
              disabled={account.systemAccount}
              onClick={() => setDeleteTarget(account)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [dash, t],
  );
  const columnLayout = useColumnVisibility("chart-of-accounts-v1", columns);

  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveSearch,
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
      isFiltered: hasActiveSearch,
      isLoading: accountsQuery.isFetching,
    },
    t,
  );

  function save(values: ChartAccountValues) {
    setFormError(null);
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

  return (
    <div>
      <PageHeader
        title={t("accounting.chartOfAccounts.title")}
        description={t("accounting.chartOfAccounts.description")}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormError(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t("accounting.chartOfAccounts.addAccount")}
          </Button>
        }
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <div>
            <CardTitle>{t("accounting.chartOfAccounts.card.title")}</CardTitle>
            <CardDescription>{t("accounting.chartOfAccounts.card.description")}</CardDescription>
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
                placeholder={t("accounting.chartOfAccounts.searchPlaceholder")}
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
          <DataTable
            columns={columnLayout.columns}
            rows={rows}
            page={page}
            isPageDataPending={accountsQuery.isFetching}
            rowKey={(account) => String(account.id)}
            rowLabel={(account) => account.displayName}
            columnLayout={columnLayout}
            minWidth={1100}
            emptyState={<p className="text-muted-foreground">{t("accounting.chartOfAccounts.empty")}</p>}
          />
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
                {t("common.pagination.pageOf", { current: page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                {t("common.actions.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? t("accounting.chartOfAccounts.form.editTitle")
                : t("accounting.chartOfAccounts.form.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? t("accounting.chartOfAccounts.form.editDescription")
                : t("accounting.chartOfAccounts.form.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <ChartAccountForm
            key={editing?.id ?? "new"}
            initialValues={editing ? accountValues(editing) : EMPTY_ACCOUNT}
            branches={branchesQuery.data?.items ?? []}
            accounts={(accountOptionsQuery.data?.items ?? []).filter(
              (account) => account.id !== editing?.id,
            )}
            isEditing={Boolean(editing)}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            error={formError}
            onSubmit={save}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("accounting.chartOfAccounts.delete.title")}</DialogTitle>
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
                    feedback.notifyDeleted(t("accounting.chartOfAccounts.entity"), 1);
                  })
                  .catch((error) => feedback.notifyError(normalizeApiError(error).message));
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
