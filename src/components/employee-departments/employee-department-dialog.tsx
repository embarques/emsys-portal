"use client";

import { Building2 } from "lucide-react";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useTranslation } from "@/lib/i18n";
import type { useDepartmentWorkspace } from "@/lib/employee-departments/hooks/use-department-workspace";

export function EmployeeDepartmentDialog({ state }: { state: ReturnType<typeof useDepartmentWorkspace> }) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation();
  return (
    <Dialog open={state.open} onOpenChange={state.setOpen}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
          <DialogTitle>{t(state.editing ? "employeeDepartments.edit" : "employeeDepartments.add")}</DialogTitle>
          <DialogDescription>{t("employeeDepartments.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={state.save} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
          <FormBody workflow isBusy={state.busy}>
            <FormSection variant="card" icon={Building2} title={t("employeeDepartments.form.details")} description={t("employeeDepartments.form.hint")}>
              <div className="space-y-1">
                <Label htmlFor="department-name">{t("employeeDepartments.name")} <span className="text-destructive">*</span></Label>
                <Input id="department-name" autoFocus required disabled={state.busy} aria-invalid={!!state.form.formState.errors.name} {...state.form.register("name")} />
                {state.form.formState.errors.name ? <p role="alert" className="text-sm text-destructive">{state.form.formState.errors.name.message}</p> : null}
              </div>
              <Label className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-3">
                <input type="checkbox" disabled={state.busy} {...state.form.register("active")} />
                {t("employeeDepartments.active")}
              </Label>
            </FormSection>
          </FormBody>
          <FormFooter error={state.error} isSubmitting={state.busy} submitLabel={t("common.actions.save")} onCancel={() => state.setOpen(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
