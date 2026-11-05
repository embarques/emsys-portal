"use client";

import { TableSelectionToolbar } from "@/components/app-shell/table-selection-toolbar";
import { Controller } from "react-hook-form";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useInvoicePool } from "@/lib/invoices/hooks/use-invoice-pool";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";

export function ReservedInvoicesWorkspace() {
  const { companyId, user, email } = useAuth();
  return <ReservedInvoicePoolPanel key={`${companyId}:${user?.uid ?? email ?? "anonymous"}`} />;
}

function ReservedInvoicePoolPanel() {
  const model = useInvoicePool();
  const { t } = useTranslation();
  const text = (key: string) => t(`invoices.pool.${key}`);
  const userId = model.form.watch("userId");
  const busy = model.mutation.isPending;
  if (!model.ready) return <p role="status">{text("loading")}</p>;
  if (!model.canView) return <p role="alert">{text("denied")}</p>;
  return <div className="space-y-6">
    <PageHeader title={text("title")} description={text("description")} actions={
      <Button variant="outline" onClick={() => void model.query.refetch()} disabled={model.query.isFetching || model.searchPending || busy}>
        <RefreshCw className="mr-2 size-4" />{text("refresh")}
      </Button>
    } />
    <Card><CardContent className="space-y-4 pt-6">
      <form className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={model.form.handleSubmit(values => model.act("generate", { ...values, userId: 0 }))}>
        <div className="space-y-2"><Label htmlFor="pool-count">{text("count")}</Label>
          <Input id="pool-count" type="number" min={1} max={100} disabled={busy || model.pending} {...model.form.register("count", { valueAsNumber: true })} />
          {model.form.formState.errors.count && <p role="alert">{text("invalidCount")}</p>}
        </div>
        <div className="flex items-end"><Button type="submit" disabled={!model.canGenerate || busy || model.pending}>{text("generate")}</Button></div>
      </form>
      <p className="text-sm text-muted-foreground">{text("generationNotice")}</p>
      {model.mutation.isError && <p role="alert" className="text-destructive">{normalizeApiError(model.mutation.error).message}</p>}
      {model.pending && !busy && <div className="flex flex-wrap items-center gap-3" role="status"><p>{text("pending")}</p><Button onClick={model.retry}>{text("retry")}</Button></div>}
      {model.mutation.isSuccess && !model.pending && <p role="status">{text("saved")}</p>}
    </CardContent></Card>
    <div className="max-w-xl space-y-2">
      <Label htmlFor="pool-search">{text("search")}</Label>
      <Input id="pool-search" type="search" value={model.numberSearch} maxLength={100} placeholder={text("searchPlaceholder")} disabled={busy || model.pending} onChange={event => model.setNumberSearch(event.target.value)} />
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-2"><Label htmlFor="pool-filter">{text("show")}</Label><select id="pool-filter" className="h-10 rounded-md border bg-background px-3" value={model.filter} onChange={event => model.setFilter(event.target.value)} disabled={busy}>
        <option value="all">{text("all")}</option><option value="0">{text("companyPool")}</option>
        {userId > 0 && <option value={String(userId)}>{text("selectedUser")}</option>}
      </select></div>
      <p className="pb-2 text-sm text-muted-foreground">{text("remaining")}: {model.query.data?.remaining ?? "—"}</p>
      <div className="space-y-2"><Label htmlFor="pool-user">{text("user")}</Label>
        <Controller name="userId" control={model.form.control} render={({ field }) =>
          <SearchableSelect id="pool-user" value={field.value > 0 ? String(field.value) : ""} onValueChange={value => field.onChange(Number(value))}
            disabled={busy || model.pending || !model.canViewUsers} manualFiltering onSearchChange={model.setUserSearch} loading={model.users.isFetching}
            options={(model.users.data?.items ?? []).map(user => ({ value: String(user.id), label: user.name || user.email }))}
            placeholder={text("user")} searchPlaceholder={text("searchUser")} emptyMessage={text("noUsers")} />
        } />
        {!model.canViewUsers && <p role="alert" className="text-sm text-destructive">{text("usersDenied")}</p>}
        {model.users.isError && <p role="alert" className="text-sm text-destructive">{normalizeApiError(model.users.error).message}</p>}
      </div>

    </div>
    <p className="text-sm text-muted-foreground">{text("downloadNotice")}</p>
    {model.selected.length > 0 && <fieldset disabled={model.selectionLocked}>
      <TableSelectionToolbar selectedIds={model.selected.map(item => item.id)} pageRowIds={model.selectable.map(item => item.id)} totalCount={model.query.data?.remaining} onSelectedIdsChange={model.setSelectedIds} hideStandardActions actions={<>
      <Button variant="outline" disabled={model.selectionLocked || !model.canAssign || !model.canAssignSelection || userId === 0} onClick={() => model.act("assign")}>{text("assign")}</Button>
      <Button variant="outline" disabled={model.selectionLocked || !model.canAssign || !model.canReturnSelection} onClick={() => model.act("return")}>{text("return")}</Button>
      </>} />
    </fieldset>}
    {model.query.isError ? <p role="alert">{normalizeApiError(model.query.error).message}</p> : model.query.isLoading || model.searchPending || model.query.isPlaceholderData ? <p role="status">{text("loading")}</p> :
      <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted"><tr>
        <th className="p-3"><input type="checkbox" aria-label={text("selectAll")} ref={element => { if (element) element.indeterminate = model.selected.length > 0 && model.selected.length < model.selectable.length; }} disabled={model.selectionLocked || model.selectable.length === 0} checked={model.selectable.length > 0 && model.selected.length === model.selectable.length} onChange={event => model.setSelectedIds(event.target.checked ? model.selectable.map(item => item.id) : [])} /></th><th className="p-3">{text("number")}</th><th className="p-3">{text("user")}</th><th className="p-3">{text("status")}</th>
      </tr></thead><tbody>{model.query.data?.items.map(item => <tr key={item.id} className="border-t">
        <td className="p-3"><input type="checkbox" aria-label={`${text("select")} ${item.number}`} disabled={model.selectionLocked || item.claimed} checked={model.selected.some(selected => selected.id === item.id)} onChange={() => model.toggle(item)} /></td>
        <td className="p-3 font-mono">{item.number}</td><td className="p-3">{item.allocation.userId ? (model.users.data?.items.find(user => user.id === item.allocation.userId)?.name ?? item.allocation.userId) : text("unassigned")}</td>
        <td className="p-3">{item.claimed ? text("downloaded") : item.allocation.userId ? text("assigned") : text("available")}</td>
      </tr>)}{model.query.data?.items.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{text("empty")}</td></tr>}</tbody></table></div>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={!model.hasPrevious || model.query.isFetching || model.searchPending || busy} onClick={model.previous}>{text("previous")}</Button>
      <Button variant="outline" disabled={!model.query.data?.nextCursor || model.query.isFetching || model.searchPending || busy} onClick={model.next}>{text("next")}</Button></div>
  </div>;
}
