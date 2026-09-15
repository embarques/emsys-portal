"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import type { useDepartmentWorkspace } from "@/lib/employee-departments/hooks/use-department-workspace";

export function EmployeeDepartmentDialog({ state }: { state: ReturnType<typeof useDepartmentWorkspace> }) {
  const { t } = useTranslation();
  return (
    <Dialog open={state.open} onOpenChange={state.setOpen}><DialogContent>
      <DialogHeader><DialogTitle>{t(state.editing ? "employeeDepartments.edit" : "employeeDepartments.add")}</DialogTitle><DialogDescription>{t("employeeDepartments.description")}</DialogDescription></DialogHeader>
      <form onSubmit={state.save} className="space-y-4">
        <div className="space-y-1"><Label htmlFor="department-name">{t("employeeDepartments.name")}</Label><Input id="department-name" autoFocus disabled={state.busy} {...state.form.register("name")} />
          {state.form.formState.errors.name ? <p role="alert" className="text-sm text-destructive">{state.form.formState.errors.name.message}</p> : null}</div>
        <Label className="flex items-center gap-2"><input type="checkbox" disabled={state.busy} {...state.form.register("active")} />{t("employeeDepartments.active")}</Label>
        {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={state.busy} onClick={() => state.setOpen(false)}>{t("common.actions.cancel")}</Button><Button type="submit" disabled={state.busy}>{t("common.actions.save")}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}
