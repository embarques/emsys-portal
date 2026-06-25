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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useChartAccounts, useCreateChartAccount, useDeleteChartAccount, useUpdateChartAccount } from "@/lib/accounting/daily-income/hooks";
import type { ChartAccount, ChartAccountValues } from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 20;
const EMPTY_ACCOUNT: ChartAccountValues = { displayName: "", type: "ASSET", description: "" };

function accountValues(account: ChartAccount): ChartAccountValues {
  return { displayName: account.displayName, type: account.type, description: account.description, branchId: account.branch?.id, branchCode: account.branch?.code, parentAccountId: account.parentAccount?.id, parentAccountName: account.parentAccount?.displayName ?? account.parentAccount?.name };
}

export function ChartOfAccountsWorkspace() {
  const feedback = useFeedback();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
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

  const columns: DataTableColumn<ChartAccount>[] = useMemo(() => [
    { id: "id", label: "#", renderCell: (account) => account.id },
    { id: "type", label: "Type", truncateCell: false, renderCell: (account) => <Badge variant="outline">{account.type}</Badge> },
    { id: "displayName", label: "Account", cellClassName: "font-medium", renderCell: (account) => account.displayName },
    { id: "branch", label: "Branch", renderCell: (account) => account.branch?.code ?? "All" },
    { id: "parent", label: "Parent account", renderCell: (account) => account.parentAccount?.displayName ?? account.parentAccount?.name ?? "—" },
    { id: "description", label: "Description", renderCell: (account) => account.description || "—" },
    { id: "system", label: "System", truncateCell: false, renderCell: (account) => account.systemAccount ? <Badge>System</Badge> : "—" },
    { id: "actions", label: "Actions", hideable: false, truncateCell: false, renderCell: (account) => <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label="Edit account" onClick={() => { setEditing(account); setFormError(null); setDialogOpen(true); }}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label="Delete account" disabled={account.systemAccount} onClick={() => setDeleteTarget(account)}><Trash2 className="h-4 w-4" /></Button></div> },
  ], []);
  const columnLayout = useColumnVisibility("chart-of-accounts-v1", columns);

  function save(values: ChartAccountValues) {
    setFormError(null);
    const action = editing ? updateMutation.mutateAsync({ id: editing.id, values }) : createMutation.mutateAsync(values);
    action.then(() => { setDialogOpen(false); setEditing(null); feedback.notifySuccess(editing ? "Account updated." : "Account created."); }).catch((error) => setFormError(normalizeApiError(error).message));
  }

  return <div>
    <PageHeader title="Chart of Accounts" description="Manage the accounts used by daily income transactions." actions={<Button onClick={() => { setEditing(null); setFormError(null); setDialogOpen(true); }}><Plus className="h-4 w-4" /> Add account</Button>} />
    <Card><CardHeader className="gap-3 border-b py-4 pb-3"><div><CardTitle>Accounts</CardTitle><CardDescription>Account hierarchy, type, branch, and availability.</CardDescription></div><TableDirectoryToolbar showFilterToggle={false} columnLayout={columnLayout} searchSummary={`Showing ${rows.length} of ${total} accounts`} search={<TableSearchInput value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder="Search by account…" />} /></CardHeader>
      {accountsQuery.isError ? <div className="px-6 py-8 text-sm text-destructive">{normalizeApiError(accountsQuery.error).message}</div> : accountsQuery.isLoading ? <div className="px-6 py-12 text-center text-muted-foreground">Loading accounts…</div> : <DataTable columns={columnLayout.columns} rows={rows} page={page} isPageDataPending={accountsQuery.isFetching} rowKey={(account) => String(account.id)} rowLabel={(account) => account.displayName} columnLayout={columnLayout} minWidth={1100} emptyState={<p className="text-muted-foreground">No accounts match your search.</p>} />}
      {!accountsQuery.isLoading && !accountsQuery.isError ? <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{accountsQuery.isFetching ? "Refreshing accounts…" : `Showing ${rows.length} of ${total} accounts`}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /> Previous</Button><span className="px-2 text-sm text-muted-foreground">Page {page} of {totalPages}</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next <ChevronRight className="h-4 w-4" /></Button></div></div> : null}
    </Card>
    <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setFormError(null); } }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editing ? "Edit account" : "Create account"}</DialogTitle><DialogDescription>{editing ? "Update the selected chart account." : "Add a new account to the accounting catalog."}</DialogDescription></DialogHeader><ChartAccountForm key={editing?.id ?? "new"} initialValues={editing ? accountValues(editing) : EMPTY_ACCOUNT} branches={branchesQuery.data?.items ?? []} accounts={(accountOptionsQuery.data?.items ?? []).filter((account) => account.id !== editing?.id)} isEditing={Boolean(editing)} isSubmitting={createMutation.isPending || updateMutation.isPending} error={formError} onSubmit={save} onCancel={() => setDialogOpen(false)} /></DialogContent></Dialog>
    <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent><DialogHeader><DialogTitle>Delete account?</DialogTitle><DialogDescription>This removes “{deleteTarget?.displayName}” from the chart of accounts.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => { if (!deleteTarget) return; deleteMutation.mutateAsync(deleteTarget.id).then(() => { setDeleteTarget(null); feedback.notifyDeleted("Account", 1); }).catch((error) => feedback.notifyError(normalizeApiError(error).message)); }}>Delete</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
