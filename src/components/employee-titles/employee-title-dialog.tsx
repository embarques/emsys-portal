"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import type { useTitleWorkspace } from "@/lib/employee-titles/hooks/use-title-workspace";

export function EmployeeTitleDialog({ state }: { state: ReturnType<typeof useTitleWorkspace> }) {
  const { t } = useTranslation();
  return (
    <Dialog open={state.open} onOpenChange={state.setOpen}><DialogContent>
      <DialogHeader><DialogTitle>{t(state.editing ? "employeeTitles.edit" : "employeeTitles.add")}</DialogTitle><DialogDescription>{t("employeeTitles.description")}</DialogDescription></DialogHeader>
      <form onSubmit={state.save} className="space-y-4">
        <div className="space-y-1"><Label htmlFor="title-name">{t("employeeTitles.name")}</Label><Input id="title-name" autoFocus disabled={state.busy} {...state.form.register("name")} />
          {state.form.formState.errors.name ? <p role="alert" className="text-sm text-destructive">{state.form.formState.errors.name.message}</p> : null}</div>
        <Label className="flex items-center gap-2"><input type="checkbox" disabled={state.busy} {...state.form.register("active")} />{t("employeeTitles.active")}</Label>
        {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        <DialogFooter><Button type="button" variant="outline" disabled={state.busy} onClick={() => state.setOpen(false)}>{t("common.actions.cancel")}</Button><Button type="submit" disabled={state.busy}>{t("common.actions.save")}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}
