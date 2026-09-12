"use client";

import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Plus,
  XCircle,
} from "lucide-react";

import { CheckForm } from "@/components/accounting/check-form";
import { CheckViewSheet } from "@/components/accounting/check-view-sheet";
import { DataTable } from "@/components/app-shell/data-table";
import { TablePaginationControls } from "@/components/app-shell/table-pagination-controls";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import {
  TableSelectionActionDivider,
  TableSelectionExpandableActionGroup,
} from "@/components/app-shell/table-selection-action-group";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { TableDirectoryToolbar } from "@/components/app-shell/table-directory-toolbar";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { TableTagText } from "@/components/app-shell/table-tag-text";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatAuditDate, formatAuditDateTime } from "@/lib/audit/display";
import { formatAccountingMoney } from "@/lib/accounting/display";
import { getCheckStatusBadgeClass } from "@/lib/accounting/checks/display";
import {
  useChecks,
  useCreateCheck,
  useDeleteChecks,
  useUpdateCheck,
} from "@/lib/accounting/checks/hooks/use-checks";
import {
  areCheckFormValuesEquivalent,
  buildCheckListParams,
  checkStatusI18nKey,
  checkToFormValues,
  createEmptyCheckForm,
  DEFAULT_CHECK_LIST_PARAMS,
  todayCheckDateInputValue,
  type Check,
  type CheckFormValues,
  type CheckStatus,
} from "@/lib/accounting/checks/types";
import { normalizeApiError } from "@/lib/api/axios";
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";
import {
  buildTableSelectionResetKey,
  useResolvedPaginatedItems,
  useTableSelectionReset,
} from "@/lib/table/directory-table-state";
import { buildToolbarSearchSummary, formatPaginatedListSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { useTableSort } from "@/lib/table/use-table-sort";
import type { DataTableColumn } from "@/lib/table/types";

const SEARCH_DEBOUNCE_MS = 300;

export function ChecksWorkspace() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const feedback = useFeedback();
  const canViewChecks = hasPermission(PERMISSIONS.checksView.name, PERMISSIONS.checksView.resourceType);
  const canCreateChecks = hasPermission(
    PERMISSIONS.checksCreate.name,
    PERMISSIONS.checksCreate.resourceType,
  );
  const canUpdateChecks = hasPermission(
    PERMISSIONS.checksUpdate.name,
    PERMISSIONS.checksUpdate.resourceType,
  );
  const canDeleteChecks = hasPermission(
    PERMISSIONS.checksDelete.name,
    PERMISSIONS.checksDelete.resourceType,
  );
  const { page, setPage, pageSize, pageLimit, changePageSize, rememberTotal } = useTablePageSize();
  const { sort, onSortChange } = useTableSort(DEFAULT_CHECK_LIST_PARAMS.sort, () => setPage(1));
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const hasActiveSearch = Boolean(query.trim());
  const isSearchPending = query.trim() !== debouncedQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewCheck, setViewCheck] = useState<Check | null>(null);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Check | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Check | Check[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const listParams = useMemo(
    () =>
      buildCheckListParams({
        page,
        limit: pageLimit,
        query: debouncedQuery,
        sort,
      }),
    [debouncedQuery, page, pageLimit, sort],
  );

  const { data, isLoading, isError, error, isFetching } = useChecks(listParams);
  const createCheckMutation = useCreateCheck();
  const updateCheckMutation = useUpdateCheck();
  const deleteChecksMutation = useDeleteChecks();
  const checks = useResolvedPaginatedItems(data?.items, data?.total, isFetching);
  const total = data?.total ?? 0;
  rememberTotal(total);
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const pageRowIds = checks.map((check) => check.id);
  const selectedChecks = checks.filter((check) => selectedIds.includes(check.id));
  const isSaving =
    createCheckMutation.isPending || updateCheckMutation.isPending || deleteChecksMutation.isPending;

  useTableSelectionReset(buildTableSelectionResetKey(debouncedQuery, sort), setSelectedIds);

  const columns: DataTableColumn<Check>[] = useMemo(
    () => [
      {
        id: "status",
        label: t("accounting.checks.columns.status"),
        truncateCell: false,
        renderCell: (check) => (
          <TableTagText className={getCheckStatusBadgeClass(check.status)}>
            {t(`accounting.checks.status.${checkStatusI18nKey(check.status)}`)}
          </TableTagText>
        ),
      },
      {
        id: "checkNumber",
        label: t("accounting.checks.columns.checkNumber"),
        cellClassName: "font-medium",
        renderCell: (check) => check.checkNumber || t("common.empty.dash"),
      },
      {
        id: "invoiceNumber",
        label: t("accounting.checks.columns.invoiceNumber"),
        sortField: "invoice.number",
        renderCell: (check) => check.invoice.number || t("common.empty.dash"),
      },
      {
        id: "paymentAmount",
        label: t("accounting.checks.columns.paymentAmount"),
        renderCell: (check) => formatAccountingMoney(check.paymentAmount),
      },
      {
        id: "datePosted",
        label: t("accounting.checks.columns.datePosted"),
        renderCell: (check) => (check.datePosted ? formatAuditDate(check.datePosted) : t("common.empty.dash")),
      },
      {
        id: "refNumber",
        label: t("accounting.checks.columns.referenceNumber"),
        renderCell: (check) => check.refNumber || t("common.empty.dash"),
      },
      {
        id: "createdAt",
        label: t("accounting.checks.columns.createdAt"),
        renderCell: (check) => (check.createdAt ? formatAuditDateTime(check.createdAt) : t("common.empty.dash")),
      },
      {
        id: "createdBy",
        label: t("accounting.checks.columns.createdBy"),
        sortField: "createdBy.name",
        renderCell: (check) => check.createdBy || t("common.empty.dash"),
      },
    ],
    [t],
  );

  const columnLayout = useColumnVisibility("accounting-checks-v3", columns);
  const searchSummary = buildToolbarSearchSummary(
    {
      isFiltered: hasActiveSearch,
      query,
      isSearchPending,
      matched: total,
      noun: t("accounting.checks.noun"),
      isLoading: isFetching && checks.length === 0,
    },
    t,
  );
  const listSummary = formatPaginatedListSummary(
    {
      itemCountOnPage: checks.length,
      page: currentPage,
      pageSize: pageLimit,
      total,
      noun: t("accounting.checks.noun"),
      isFiltered: hasActiveSearch,
      isLoading: isFetching,
    },
    t,
  );

  function openCreateDialog() {
    if (!canCreateChecks) return;
    setViewCheck(null);
    setEditing(null);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(check: Check) {
    if (!canUpdateChecks) return;
    setViewCheck(null);
    setEditing(check);
    setFormError(null);
    setDialogOpen(true);
  }

  async function saveCheck(values: CheckFormValues) {
    if (editing ? !canUpdateChecks : !canCreateChecks) {
      feedback.notifyError(t("common.errors.api.forbidden"));
      return;
    }

    setFormError(null);

    try {
      if (editing) {
        if (areCheckFormValuesEquivalent(values, checkToFormValues(editing))) {
          feedback.notifySuccess(t("common.form.noChanges"));
          setDialogOpen(false);
          setEditing(null);
          return;
        }
        await updateCheckMutation.mutateAsync({
          checkId: editing.id,
          values,
          journalId: editing.journalId,
        });
        feedback.notifySuccess(t("accounting.checks.toasts.updated"));
      } else {
        await createCheckMutation.mutateAsync({ ...values, status: "OUTSTANDING" });
        feedback.notifySuccess(t("accounting.checks.toasts.created"));
      }

      setDialogOpen(false);
      setEditing(null);
    } catch (saveError) {
      setFormError(normalizeApiError(saveError).message);
    }
  }

  async function applyStatus(status: CheckStatus) {
    if (!canUpdateChecks) {
      feedback.notifyError(t("common.errors.api.forbidden"));
      return;
    }

    const targets = selectedChecks.length > 0
      ? selectedChecks
      : checks.filter((check) => selectedIds.includes(check.id));
    if (targets.length === 0) return;
    const today = todayCheckDateInputValue();

    try {
      for (const check of targets) {
        await updateCheckMutation.mutateAsync({
          checkId: check.id,
          journalId: check.journalId,
          values: {
            ...checkToFormValues(check),
            status,
            clearedAt: status === "CLEARED" ? check.clearedAt.slice(0, 10) || today : "",
          },
        });
      }

      const count = targets.length;
      feedback.notifySuccess(
        status === "OUTSTANDING"
          ? count === 1
            ? t("accounting.checks.toasts.markedOutstanding", { count })
            : t("accounting.checks.toasts.markedOutstanding_plural", { count })
          : count === 1
            ? t("accounting.checks.toasts.markedCleared", { count })
            : t("accounting.checks.toasts.markedCleared_plural", { count }),
      );
      setStatusExpanded(false);
      setSelectedIds([]);
    } catch (statusError) {
      feedback.notifyError(normalizeApiError(statusError).message);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (!canDeleteChecks) {
      feedback.notifyError(t("common.errors.api.forbidden"));
      return;
    }

    const targets = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget];
    const ids = targets.map((check) => check.id);

    try {
      const result = await deleteChecksMutation.mutateAsync(ids);

      reportBulkSettled({
        result,
        t,
        notifyError: feedback.notifyError,
        onSucceeded: (count) => {
          feedback.notifySuccess(
            count === 1
              ? t("accounting.checks.toasts.deleted")
              : t("accounting.checks.toasts.deleted_plural", { count }),
          );
        },
        onAllFailed: (message) => {
          feedback.notifyError(message);
        },
        onDone: () => {
          setSelectedIds((current) => current.filter((id) => !result.succeededIds.includes(id)));
          setDeleteTarget(null);
        },
      });
    } catch (deleteError) {
      feedback.notifyError(normalizeApiError(deleteError).message);
    }
  }

  const deleteCount = Array.isArray(deleteTarget) ? deleteTarget.length : deleteTarget ? 1 : 0;

  return (
    <div>
      <PageHeader
        title={t("accounting.checks.title")}
        description={t("accounting.checks.description")}
        actions={
          canCreateChecks ? (
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t("accounting.checks.addCheck")}
            </Button>
          ) : null
        }
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <div>
            <CardTitle>{t("accounting.checks.title")}</CardTitle>
            <CardDescription>{t("accounting.checks.description")}</CardDescription>
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
                placeholder={t("accounting.checks.searchPlaceholder")}
              />
            }
          />
        </CardHeader>

        <TableSelectionToolbar
          selectedIds={selectedIds}
          pageRowIds={pageRowIds}
          totalCount={total}
          onSelectedIdsChange={setSelectedIds}
          onView={() => {
            const check = selectedChecks[0];
            if (check) setViewCheck(check);
          }}
          canView={canViewChecks}
          onEdit={() => {
            const check = selectedChecks[0];
            if (check) openEditDialog(check);
          }}
          canEdit={canUpdateChecks}
          onDelete={() => setDeleteTarget(selectedChecks)}
          canDelete={canDeleteChecks}
          deleteDisabled={isSaving}
          actions={
            canUpdateChecks ? (
              <>
                <TableSelectionActionDivider />
                <TableSelectionExpandableActionGroup
                  label={t("accounting.checks.actions.manageStatus")}
                  icon={Banknote}
                  expanded={statusExpanded}
                  onExpandedChange={setStatusExpanded}
                  aria-label={t("accounting.checks.actions.statusGroup")}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => applyStatus("CLEARED")}
                    className="bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t("accounting.checks.actions.markCleared")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => applyStatus("OUTSTANDING")}
                    className="bg-amber-500/5 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-300"
                  >
                    <XCircle className="h-4 w-4" />
                    {t("accounting.checks.actions.markOutstanding")}
                  </Button>
                </TableSelectionExpandableActionGroup>
              </>
            ) : null
          }
        />

        {isError ? (
          <div className="border-b px-6 py-3 text-sm text-destructive">{normalizeApiError(error).message}</div>
        ) : (
          <DataTable
            columns={columnLayout.columns}
            rows={checks}
            page={currentPage}
            isPageDataPending={isFetching}
            rowKey={(check) => check.id}
            rowLabel={(check) => check.checkNumber || check.invoice.number}
            columnLayout={columnLayout}
            minWidth={1100}
            sort={sort}
            onSortChange={onSortChange}
            selectable
            selectedIds={selectedIds}
            allPageSelected={pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.includes(id))}
            onToggleSelectAll={(checked) => {
              if (checked) {
                setSelectedIds((current) => Array.from(new Set([...current, ...pageRowIds])));
                return;
              }

              setSelectedIds((current) => current.filter((id) => !pageRowIds.includes(id)));
            }}
            onToggleSelect={(id, checked) => {
              setSelectedIds((current) =>
                checked ? Array.from(new Set([...current, id])) : current.filter((entry) => entry !== id),
              );
            }}
            onRowClick={canViewChecks ? setViewCheck : undefined}
            onRowDoubleClick={canUpdateChecks ? openEditDialog : undefined}
            activeRowId={viewCheck?.id}
            emptyState={
              <>
                <p className="text-muted-foreground">
                  {hasActiveSearch ? t("accounting.checks.empty") : t("accounting.checks.emptyNone")}
                </p>
                {canCreateChecks ? (
                  <Button className="mt-4" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4" />
                    {t("accounting.checks.addCheck")}
                  </Button>
                ) : null}
              </>
            }
          />
        )}

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{listSummary}</p>
          <TablePaginationControls
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
            disabled={isLoading}
          />
        </div>
      </Card>

      <CheckViewSheet
        check={viewCheck}
        open={Boolean(viewCheck)}
        onOpenChange={(open) => {
          if (!open) setViewCheck(null);
        }}
        onEdit={openEditDialog}
        onDelete={(check) => {
          setViewCheck(null);
          setDeleteTarget(check);
        }}
        canEdit={canUpdateChecks}
        canDelete={canDeleteChecks}
      />

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
        <DialogContent className="flex max-h-[min(90vh,720px)] flex-col overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("accounting.checks.form.editTitle") : t("accounting.checks.form.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? t("accounting.checks.form.editDescription")
                : t("accounting.checks.form.createDescription")}
            </DialogDescription>
          </DialogHeader>
          <CheckForm
            key={editing?.id ?? "new"}
            initialValues={editing ? checkToFormValues(editing) : createEmptyCheckForm()}
            isEditing={Boolean(editing)}
            isSubmitting={isSaving}
            externalError={formError}
            onSubmit={saveCheck}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteCount === 1
                ? t("accounting.checks.delete.title")
                : t("accounting.checks.delete.title_plural", { count: deleteCount })}
            </DialogTitle>
            <DialogDescription>
              {deleteCount === 1 && !Array.isArray(deleteTarget) && deleteTarget
                ? t("accounting.checks.delete.description", {
                    checkNumber: deleteTarget.checkNumber,
                  })
                : t("accounting.checks.delete.description_plural", { count: deleteCount })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <Button variant="destructive" disabled={isSaving} onClick={confirmDelete}>
              {t("common.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
