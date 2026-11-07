"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { ChevronLeft, ChevronRight, FileText, Plus, RefreshCw } from "lucide-react";

import { DataTable } from "@/components/app-shell/data-table";
import { FormBody, FormFooter } from "@/components/forms/form-shell";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { InfoHint } from "@/components/app-shell/info-hint";
import { PageHeader } from "@/components/app-shell/page-header";
import { InvoiceWizardNotice } from "@/components/invoices/invoice-wizard-notice";
import { TableDirectoryToolbar, TableFilterPanel } from "@/components/app-shell/table-directory-toolbar";
import { TableAdvancedFilterBuilder } from "@/components/app-shell/table-advanced-filter-builder";
import { countCompleteFilterRows } from "@/lib/table/filter-builder";
import { INVOICE_POOL_FILTER_FIELDS } from "@/lib/invoices/invoice-pool-filters";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { normalizeApiError } from "@/lib/api/axios";
import { formatAuditDateTime } from "@/lib/audit/display";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { useInvoicePool } from "@/lib/invoices/hooks/use-invoice-pool";
import { useInvoicePoolLowStock } from "@/lib/invoices/hooks/use-invoice-pool-low-stock";
import type { ReservedInvoice } from "@/lib/invoices/schemas/invoice-pool.schema";
import type { DataTableColumn } from "@/lib/table/types";

export function ReservedInvoicesWorkspace() {
  const { companyId, user, email } = useAuth();
  return <ReservedInvoicePoolPanel key={`${companyId}:${user?.uid ?? email ?? "anonymous"}`} />;
}

function ReservedInvoicePoolPanel() {
  const model = useInvoicePool();
  const lowStock = useInvoicePoolLowStock();
  const { t } = useTranslation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const text = (key: string) => t(`invoices.pool.${key}`);
  const userId = model.form.watch("userId");
  const busy = model.mutation.isPending;
  const dialogOpen = generateOpen || assignOpen;
  const showStatus = (model.justGenerated && !model.pending) || (model.mutation.isError && !dialogOpen) || (model.pending && !busy) || (model.mutation.isSuccess && !model.pending);
  const openGenerate = () => {
    model.mutation.reset();
    model.form.clearErrors("count");
    setGenerateOpen(true);
  };
  const openAssign = () => {
    model.mutation.reset();
    model.form.setValue("userId", 0);
    setAssignOpen(true);
  };
  const loading = model.query.isLoading || model.searchPending || model.query.isPlaceholderData;
  const filterFields = INVOICE_POOL_FILTER_FIELDS.map(field => ({
    ...field,
    label: text(field.field === "allocation.userId" ? "user" : field.field),
    ...(field.field === "status" ? { options: field.options?.map(option => ({ ...option, label: text(option.value) })) } : {}),
  }));
  const activeFilterCount = countCompleteFilterRows(model.filterRows, filterFields);
  const hasFilters = activeFilterCount > 0 || Boolean(model.numberSearch.trim());
  const remaining = `${text("remaining")}: ${loading ? "—" : model.query.data?.remaining ?? "—"}`;
  const columns: DataTableColumn<ReservedInvoice>[] = [
    {
      id: "number",
      label: text("number"),
      hideable: false,
      cellClassName: "font-mono font-medium",
      renderCell: (item) => item.number,
    },
    {
      id: "receivedAt",
      label: text("receivedAt"),
      cellClassName: "text-muted-foreground",
      renderCell: (item) => item.receivedAt ? formatAuditDateTime(item.receivedAt) : "—",
    },
    {
      id: "user",
      label: text("user"),
      renderCell: (item) => item.allocation.userId
        ? (model.users.data?.items.find(user => user.id === item.allocation.userId)?.name ?? item.allocation.userId)
        : <span className="text-muted-foreground">{text("unassigned")}</span>,
    },
    {
      id: "status",
      label: text("status"),
      renderCell: (item) => (
        <div className="flex items-center gap-1">
          <Badge variant={item.claimed ? "secondary" : "outline"} className={item.claimed ? undefined : item.allocation.userId ? "border-primary/20 bg-primary/10 text-primary" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}>
            {item.claimed ? text("downloaded") : item.allocation.userId ? text("assigned") : text("available")}
          </Badge>
          {item.claimed && <InfoHint message={text("downloadNotice")} label={text("downloadNoticeLabel")} />}
        </div>
      ),
    },
  ];
  const columnLayout = useColumnVisibility("reserved-invoices", columns);

  if (!model.ready) return <p role="status">{text("loading")}</p>;
  if (!model.canView) return <p role="alert">{text("denied")}</p>;

  return (
    <div>
      <PageHeader title={text("title")} description={text("description")} actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void model.query.refetch()} disabled={model.query.isFetching || model.searchPending || busy}>
            <RefreshCw className="size-4" />{text("refresh")}
          </Button>
          <Button onClick={openGenerate} disabled={!model.canGenerate || busy || model.pending}>
            <Plus className="size-4" />{text("generate")}
          </Button>
        </div>
      } />

      {lowStock.isLow && lowStock.remaining !== null && lowStock.threshold !== null && (
        <InvoiceWizardNotice
          tone="error"
          className="mb-6 rounded-md border px-4 sm:px-4"
          message={t("invoices.pool.lowStockWarning", { remaining: lowStock.remaining, threshold: lowStock.threshold })}
          action={
            <Button size="sm" variant="outline" onClick={openGenerate} disabled={!model.canGenerate || busy || model.pending}>
              <Plus className="size-4" />{text("generateMore")}
            </Button>
          }
        />
      )}

      {showStatus && (
        <Card className="mb-6">
          <CardContent className="space-y-3">
            {model.justGenerated && !model.pending && <InvoiceWizardNotice tone="warning" message={text("generationNotice")} className="rounded-md border px-3 sm:px-3" />}
            {model.mutation.isError && !dialogOpen && <p role="alert" className="text-sm text-destructive">{normalizeApiError(model.mutation.error).message}</p>}
            {model.pending && !busy && <div className="flex flex-wrap items-center gap-3" role="status"><p className="text-sm">{text("pending")}</p><Button onClick={model.retry}>{text("retry")}</Button></div>}
            {model.mutation.isSuccess && !model.pending && <p role="status" className="text-sm">{text("saved")}</p>}
          </CardContent>
        </Card>
      )}

      <Dialog open={generateOpen} onOpenChange={open => { if (!busy) setGenerateOpen(open); }}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
            <DialogTitle>{text("generate")}</DialogTitle>
            <DialogDescription>{text("generatePrompt")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={model.form.handleSubmit(values => model.act("generate", { ...values, userId: 0 }, () => setGenerateOpen(false)))} className="flex min-h-0 flex-1 flex-col">
            <FormBody isBusy={busy}>
              <div className="space-y-2">
                <Label htmlFor="pool-count">{text("count")}</Label>
                <Input id="pool-count" type="number" min={1} max={100} autoFocus disabled={busy || model.pending} aria-invalid={Boolean(model.form.formState.errors.count)} aria-describedby={model.form.formState.errors.count ? "pool-count-error" : undefined} {...model.form.register("count", { valueAsNumber: true })} />
                {model.form.formState.errors.count && <p id="pool-count-error" role="alert" className="text-sm text-destructive">{text("invalidCount")}</p>}
              </div>
            </FormBody>
            <FormFooter
              error={model.mutation.isError ? normalizeApiError(model.mutation.error).message : null}
              submitLabel={text("generate")}
              isSubmitting={busy}
              submitDisabled={!model.canGenerate || model.pending}
              onCancel={() => setGenerateOpen(false)}
            />
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={open => { if (!busy) setAssignOpen(open); }}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
            <DialogTitle>{text("assignTitle")}</DialogTitle>
            <DialogDescription>{t("invoices.pool.assignPrompt", { count: model.selected.length })}</DialogDescription>
          </DialogHeader>
          <form onSubmit={event => { event.preventDefault(); if (userId > 0) model.act("assign", undefined, () => setAssignOpen(false)); }} className="flex min-h-0 flex-1 flex-col">
            <FormBody isBusy={busy}>
              <div className="space-y-2">
                <Label htmlFor="pool-user">{text("user")}</Label>
                <Controller name="userId" control={model.form.control} render={({ field }) =>
                  <SearchableSelect id="pool-user" className="w-full" value={field.value > 0 ? String(field.value) : ""} onValueChange={value => field.onChange(Number(value))}
                    disabled={busy || model.pending || !model.canViewUsers} manualFiltering onSearchChange={model.setUserSearch} loading={model.users.isFetching}
                    options={(model.users.data?.items ?? []).map(user => ({ value: String(user.id), label: user.name || user.email }))}
                    placeholder={text("user")} searchPlaceholder={text("searchUser")} emptyMessage={text("noUsers")} />
                } />
                {!model.canViewUsers && <p role="alert" className="text-sm text-destructive">{text("usersDenied")}</p>}
                {model.users.isError && <p role="alert" className="text-sm text-destructive">{normalizeApiError(model.users.error).message}</p>}
              </div>
            </FormBody>
            <FormFooter
              error={model.mutation.isError ? normalizeApiError(model.mutation.error).message : null}
              submitLabel={text("assignSubmit")}
              isSubmitting={busy}
              submitDisabled={userId === 0 || !model.canAssign || !model.canAssignSelection || model.selectionLocked}
              onCancel={() => setAssignOpen(false)}
            />
          </form>
        </DialogContent>
      </Dialog>

      <Card className="gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <TableDirectoryToolbar
            search={<TableSearchInput value={model.numberSearch} onChange={model.setNumberSearch} maxLength={100} placeholder={text("search")} disabled={busy || model.pending} />}
            searchSummary={remaining}
            columnLayout={columnLayout}
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            filterPanel={
              <TableFilterPanel resultSummary={remaining}
                presets={{ storageKey: "reserved-invoices", rows: model.filterRows, fields: filterFields, onApply: model.setFilterRows }}
                onClearAll={hasFilters ? () => { model.setFilterRows([]); model.setNumberSearch(""); } : undefined}>
                <TableAdvancedFilterBuilder
                  open={filtersOpen}
                  rows={model.filterRows}
                  fields={filterFields}
                  dynamicOptions={{ users: [{ value: "0", label: text("companyPool") }, ...model.filterUserOptions] }}
                  dynamicSearch={{ users: { onSearchChange: model.setFilterUserSearch, loading: model.filterUsers.isFetching } }}
                  onChange={model.setFilterRows}
                />
                {!model.canViewUsers && <p role="alert" className="text-sm text-destructive">{text("usersDenied")}</p>}
                {model.filterUsers.isError && <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
                  <span>{normalizeApiError(model.filterUsers.error).message}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => void model.filterUsers.refetch()}>{t("common.actions.retry")}</Button>
                </div>}
              </TableFilterPanel>
            }
          />
        </CardHeader>

        {model.selected.length > 0 && <fieldset disabled={model.selectionLocked}>
          <TableSelectionToolbar selectedIds={model.selected.map(item => item.id)} pageRowIds={model.selectable.map(item => item.id)} totalCount={model.query.data?.remaining} onSelectedIdsChange={model.setSelectedIds} hideStandardActions actions={<>
            <Button variant="outline" size="sm" disabled={model.selectionLocked || !model.canAssign || !model.canAssignSelection} onClick={openAssign}>{text("assign")}</Button>
            <Button variant="outline" size="sm" disabled={model.selectionLocked || !model.canAssign || !model.canReturnSelection} onClick={() => model.act("return")}>{text("return")}</Button>
          </>} />
        </fieldset>}

        {model.query.isError ? <p role="alert" className="px-6 py-8 text-sm text-destructive">{normalizeApiError(model.query.error).message}</p> : loading ? (
          <DirectoryTableLoader icon={FileText} title={text("loading")} description={text("description")} columns={columns.map(column => column.label)} />
        ) : (
          <fieldset className="min-w-0" disabled={model.selectionLocked}>
            <DataTable
              columns={columnLayout.columns}
              rows={model.query.data?.items ?? []}
              rowKey={item => item.id}
              rowLabel={item => item.number}
              columnLayout={columnLayout}
              minWidth={560}
              isPageDataPending={model.query.isFetching}
              selectable
              isRowSelectable={item => !model.selectionLocked && !item.claimed}
              selectedIds={model.selected.map(item => item.id)}
              allPageSelected={model.selectable.length > 0 && model.selected.length === model.selectable.length}
              selectAllLabel={text("selectAll")}
              selectAllDisabled={model.selectionLocked || model.selectable.length === 0}
              selectAllIndeterminate={model.selected.length > 0 && model.selected.length < model.selectable.length}
              onToggleSelectAll={checked => model.setSelectedIds(checked ? model.selectable.map(item => item.id) : [])}
              onToggleSelect={id => { const item = model.selectable.find(item => item.id === id); if (item) model.toggle(item); }}
              emptyState={<p className="text-muted-foreground">{text("empty")}</p>}
            />
          </fieldset>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
          <p className="text-sm text-muted-foreground" aria-live="polite">{remaining}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!model.hasPrevious || model.query.isFetching || model.searchPending || busy} onClick={model.previous}><ChevronLeft className="size-4" />{text("previous")}</Button>
            <Button variant="outline" size="sm" disabled={!model.query.data?.nextCursor || model.query.isFetching || model.searchPending || busy} onClick={model.next}>{text("next")}<ChevronRight className="size-4" /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
