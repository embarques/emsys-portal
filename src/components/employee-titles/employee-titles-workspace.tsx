"use client";
import { formatAuditDateTime } from "@/lib/audit/display";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { EmployeeTitleDialog } from "@/components/employee-titles/employee-title-dialog";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/lib/auth/guards/permission-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { useTitleWorkspace } from "@/lib/employee-titles/hooks/use-title-workspace";

export function EmployeeTitlesWorkspace() {
  const { t } = useTranslation();
  const state = useTitleWorkspace();
  return <div className="max-w-full overflow-x-hidden">
    <PageHeader title={t("employeeTitles.title")} description={t("employeeTitles.description")} actions={
      <PermissionGuard permission={PERMISSIONS.employeeTitlesCreate}>
        <Button onClick={() => state.edit(null)}><Plus className="size-4" />{t("employeeTitles.add")}</Button>
      </PermissionGuard>
    } />
    <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
      {state.query.isLoading ? <p className="p-6">{t("common.loading")}</p> : state.query.isError ?
        <div className="p-6"><p role="alert" className="text-destructive">{normalizeApiError(state.query.error).message}</p><Button variant="outline" onClick={() => void state.query.refetch()}>{t("employeeTitles.retry")}</Button></div> :
        !state.query.data?.length ? <p className="p-6">{t("employeeTitles.empty")}</p> :
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr>
            <th className="px-4 py-3">ID</th><th className="px-4 py-3">{t("employeeTitles.name")}</th><th className="px-4 py-3">{t("employeeTitles.active")}</th><th className="px-4 py-3">{t("common.apiColumns.createdAt")}</th><th className="px-4 py-3">{t("common.apiColumns.updatedAt")}</th><th className="px-4 py-3 text-right">{t("common.actions.actions")}</th>
          </tr></thead>
          <tbody>{state.query.data.map((item) => <tr key={item.id} className="border-b last:border-0">
            <td className="px-4 py-3">{item.id}</td><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3">{t(item.active ? "employeeTitles.active" : "employeeTitles.inactive")}</td>
            <td className="px-4 py-3">{item.createdAt ? formatAuditDateTime(item.createdAt) : t("common.empty.dash")}</td><td className="px-4 py-3">{item.updatedAt ? formatAuditDateTime(item.updatedAt) : t("common.empty.dash")}</td>
            <td className="px-4 py-3"><div className="flex justify-end gap-1">
              <PermissionGuard permission={PERMISSIONS.employeeTitlesUpdate}><Button variant="ghost" size="icon" disabled={state.busy} onClick={() => state.edit(item)} aria-label={t("common.actions.edit")}><Pencil className="size-4" /></Button></PermissionGuard>
              <PermissionGuard permission={PERMISSIONS.employeeTitlesDelete}><Button variant="ghost" size="icon" disabled={state.busy} onClick={() => void state.remove(item)} aria-label={t("common.actions.delete")}><Trash2 className="size-4" /></Button></PermissionGuard>
            </div></td>
          </tr>)}</tbody>
        </table>}
    </div>
    <EmployeeTitleDialog state={state} />
  </div>;
}
