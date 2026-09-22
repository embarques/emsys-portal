"use client";

import { BriefcaseBusiness } from "lucide-react";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useTranslation } from "@/lib/i18n";
import type { useTitleWorkspace } from "@/lib/employee-titles/hooks/use-title-workspace";

export function EmployeeTitleDialog({ state }: { state: ReturnType<typeof useTitleWorkspace> }) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation();
  return (
    <Dialog open={state.open} onOpenChange={state.setOpen}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
          <DialogTitle>{t(state.editing ? "employeeTitles.edit" : "employeeTitles.add")}</DialogTitle>
          <DialogDescription>{t("employeeTitles.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={state.save} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
          <FormBody workflow isBusy={state.busy}>
            <FormSection variant="card" icon={BriefcaseBusiness} title={t("employeeTitles.form.details")} description={t("employeeTitles.form.hint")}>
              <div className="space-y-1">
                <Label htmlFor="title-name">{t("employeeTitles.name")} <span className="text-destructive">*</span></Label>
                <Input id="title-name" autoFocus required disabled={state.busy} aria-invalid={!!state.form.formState.errors.name} {...state.form.register("name")} />
                {state.form.formState.errors.name ? <p role="alert" className="text-sm text-destructive">{state.form.formState.errors.name.message}</p> : null}
              </div>
              <Label className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-3">
                <input type="checkbox" disabled={state.busy} {...state.form.register("active")} />
                {t("employeeTitles.active")}
              </Label>
            </FormSection>
          </FormBody>
          <FormFooter error={state.error} isSubmitting={state.busy} submitLabel={t("common.actions.save")} onCancel={() => state.setOpen(false)} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
