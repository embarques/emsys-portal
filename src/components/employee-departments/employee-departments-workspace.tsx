"use client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { EmployeeDepartmentDialog } from "@/components/employee-departments/employee-department-dialog";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { PermissionGuard } from "@/lib/auth/guards/permission-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { useDepartmentWorkspace } from "@/lib/employee-departments/hooks/use-department-workspace";

export function EmployeeDepartmentsWorkspace() {
  const { t } = useTranslation();
  const state = useDepartmentWorkspace();
  return <div className="max-w-full overflow-x-hidden">
    <PageHeader title={t("employeeDepartments.title")} description={t("employeeDepartments.description")} actions={
      <PermissionGuard permission={PERMISSIONS.employeeDepartmentsCreate}>
        <Button onClick={() => state.edit(null)}><Plus className="size-4" />{t("employeeDepartments.add")}</Button>
      </PermissionGuard>
    } />
    <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
      {state.query.isLoading ? <p className="p-6">{t("common.loading")}</p> : state.query.isError ?
        <div className="p-6"><p role="alert" className="text-destructive">{normalizeApiError(state.query.error).message}</p><Button variant="outline" onClick={() => void state.query.refetch()}>{t("employeeDepartments.retry")}</Button></div> :
        !state.query.data?.length ? <p className="p-6">{t("employeeDepartments.empty")}</p> :
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left"><tr>
            <th className="px-4 py-3">ID</th><th className="px-4 py-3">{t("employeeDepartments.name")}</th><th className="px-4 py-3">{t("employeeDepartments.active")}</th><th className="px-4 py-3 text-right">{t("common.actions.actions")}</th>
          </tr></thead>
          <tbody>{state.query.data.map((item) => <tr key={item.id} className="border-b last:border-0">
            <td className="px-4 py-3">{item.id}</td><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3">{t(item.active ? "employeeDepartments.active" : "employeeDepartments.inactive")}</td>
            <td className="px-4 py-3"><div className="flex justify-end gap-1">
              <PermissionGuard permission={PERMISSIONS.employeeDepartmentsUpdate}><Button variant="ghost" size="icon" disabled={state.busy} onClick={() => state.edit(item)} aria-label={t("common.actions.edit")}><Pencil className="size-4" /></Button></PermissionGuard>
              <PermissionGuard permission={PERMISSIONS.employeeDepartmentsDelete}><Button variant="ghost" size="icon" disabled={state.busy} onClick={() => void state.remove(item)} aria-label={t("common.actions.delete")}><Trash2 className="size-4" /></Button></PermissionGuard>
            </div></td>
          </tr>)}</tbody>
        </table>}
    </div>
    <EmployeeDepartmentDialog state={state} />
  </div>;
}
