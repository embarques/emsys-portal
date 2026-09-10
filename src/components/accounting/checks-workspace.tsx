"use client";

import { useDeferredValue, useMemo, useState } from "react";
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
import { formatAuditDateTime } from "@/lib/audit/display";
import { getCheckStatusBadgeClass } from "@/lib/accounting/checks/display";
import { useChecksStore } from "@/lib/accounting/checks/use-checks-store";
import {
  areCheckFormValuesEquivalent,
  checkToFormValues,
  createEmptyCheckForm,
  formValuesToCheck,
  type Check,
  type CheckStatus,
} from "@/lib/accounting/checks/types";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";
import { buildToolbarSearchSummary } from "@/lib/table/list-summary";
import { useTablePageSize } from "@/lib/table/hooks/use-table-page-size";
import { resolveClientTablePageLimit } from "@/lib/table/page-size";
import type { DataTableColumn } from "@/lib/table/types";

function matchesQuery(check: Check, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    check.invoiceNumber,
    check.receiptNumber,
    check.referenceNumber,
    check.createdBy,
    check.status,
  ].some((value) => value.toLowerCase().includes(normalized));
}

function createCheckId(): string {
  return `chk-${Date.now()}`;
}

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
  const { checks, setChecks } = useChecksStore();
  const { page, setPage, pageSize, changePageSize } = useTablePageSize();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const hasActiveSearch = Boolean(query.trim());
  const isSearchPending = query.trim() !== deferredQuery.trim();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewCheck, setViewCheck] = useState<Check | null>(null);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Check | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Check | Check[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filteredChecks = useMemo(
    () => checks.filter((check) => matchesQuery(check, deferredQuery)),
    [checks, deferredQuery],
  );

  const total = filteredChecks.length;
  const pageLimit = resolveClientTablePageLimit(pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageLimit;
  const rows = filteredChecks.slice(pageStart, pageStart + pageLimit);
  const pageRowIds = rows.map((check) => check.id);

  const selectedChecks = useMemo(
    () => checks.filter((check) => selectedIds.includes(check.id)),
    [checks, selectedIds],
  );

  const columns: DataTableColumn<Check>[] = useMemo(
    () => [
      {
        id: "status",
        label: t("accounting.checks.columns.status"),
        truncateCell: false,
        renderCell: (check) => (
          <TableTagText className={getCheckStatusBadgeClass(check.status)}>
            {t(`accounting.checks.status.${check.status}`)}
          </TableTagText>
        ),
      },
      {
        id: "invoiceNumber",
        label: t("accounting.checks.columns.invoiceNumber"),
        cellClassName: "font-medium",
        renderCell: (check) => check.invoiceNumber,
      },
      {
        id: "receiptNumber",
        label: t("accounting.checks.columns.receiptNumber"),
        renderCell: (check) => check.receiptNumber,
      },
      {
        id: "referenceNumber",
        label: t("accounting.checks.columns.referenceNumber"),
        renderCell: (check) => check.referenceNumber || t("common.empty.dash"),
      },
      {
        id: "createdAt",
        label: t("accounting.checks.columns.createdAt"),
        renderCell: (check) => formatAuditDateTime(check.createdAt),
      },
      {
        id: "createdBy",
        label: t("accounting.checks.columns.createdBy"),
        renderCell: (check) => check.createdBy,
      },
    ],
    [t],
  );

  const columnLayout = useColumnVisibility("accounting-checks-v2", columns);

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

  function saveCheck(values: ReturnType<typeof createEmptyCheckForm>) {
    if (editing ? !canUpdateChecks : !canCreateChecks) {
      feedback.notifyError(t("common.errors.api.forbidden"));
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editing) {
        if (areCheckFormValuesEquivalent(values, checkToFormValues(editing))) {
          feedback.notifySuccess(t("common.form.noChanges"));
          setDialogOpen(false);
          setEditing(null);
          return;
        }
        const updated = formValuesToCheck(editing.id, values, editing.createdAt);
        setChecks((current) => current.map((check) => (check.id === editing.id ? updated : check)));
        feedback.notifySuccess(t("accounting.checks.toasts.updated"));
      } else {
        const created = formValuesToCheck(createCheckId(), { ...values, status: "outstanding" });
        setChecks((current) => [created, ...current]);
        feedback.notifySuccess(t("accounting.checks.toasts.created"));
      }

      setDialogOpen(false);
      setEditing(null);
    } finally {
      setIsSaving(false);
    }
  }

  function applyStatus(status: CheckStatus) {
    if (!canUpdateChecks) {
      feedback.notifyError(t("common.errors.api.forbidden"));
      return;
    }

    const now = new Date().toISOString();

    setChecks((current) =>
      current.map((check) => {
        if (!selectedIds.includes(check.id)) return check;

        if (status === "outstanding") {
          return {
            ...check,
            status,
            depositedAt: null,
            depositedOn: null,
            depositedBy: null,
          };
        }

        return {
          ...check,
          status,
          depositedAt: check.depositedAt ?? now,
          depositedOn: check.depositedOn ?? "Wells Fargo · USA Operating",
          depositedBy: check.depositedBy ?? check.createdBy,
        };
      }),
    );

    const count = selectedIds.length;
    feedback.notifySuccess(
      status === "outstanding"
        ? count === 1
          ? t("accounting.checks.toasts.markedOutstanding", { count })
          : t("accounting.checks.toasts.markedOutstanding_plural", { count })
        : count === 1
          ? t("accounting.checks.toasts.markedCleared", { count })
          : t("accounting.checks.toasts.markedCleared_plural", { count }),
    );
    setStatusExpanded(false);
    setSelectedIds([]);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    if (!canDeleteChecks) {
      feedback.notifyError(t("common.errors.api.forbidden"));
      return;
    }

    const targets = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget];
    const ids = new Set(targets.map((check) => check.id));

    setChecks((current) => current.filter((check) => !ids.has(check.id)));
    setSelectedIds((current) => current.filter((id) => !ids.has(id)));
    setDeleteTarget(null);

    const count = targets.length;
    feedback.notifySuccess(
      count === 1
        ? t("accounting.checks.toasts.deleted")
        : t("accounting.checks.toasts.deleted_plural", { count }),
    );
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
            searchSummary={buildToolbarSearchSummary(
              {
                isFiltered: hasActiveSearch,
                query,
                isSearchPending,
                matched: total,
                noun: t("accounting.checks.noun"),
              },
              t,
            )}
            search={
              <TableSearchInput
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setPage(1);
                  setSelectedIds([]);
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
                    onClick={() => applyStatus("cleared")}
                    className="bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {t("accounting.checks.actions.markCleared")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSaving}
                    onClick={() => applyStatus("outstanding")}
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

        <DataTable
          columns={columnLayout.columns}
          rows={rows}
          page={currentPage}
          rowKey={(check) => check.id}
          rowLabel={(check) => check.receiptNumber}
          columnLayout={columnLayout}
          minWidth={1000}
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
              <p className="text-muted-foreground">{t("accounting.checks.empty")}</p>
              {canCreateChecks ? (
                <Button className="mt-4" onClick={openCreateDialog}>
                  <Plus className="h-4 w-4" />
                  {t("accounting.checks.addCheck")}
                </Button>
              ) : null}
            </>
          }
        />

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {t("common.pagination.showingOf", {
              count: rows.length,
              total,
              noun: t("accounting.checks.noun"),
            })}
          </p>
          <TablePaginationControls
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={changePageSize}
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
                    receiptNumber: deleteTarget.receiptNumber,
                  })
                : t("accounting.checks.delete.description_plural", { count: deleteCount })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.actions.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {t("common.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
