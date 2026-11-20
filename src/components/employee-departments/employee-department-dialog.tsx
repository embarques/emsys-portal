"use client";

import { Save } from "lucide-react";

import {
  CompactActionDialogContent,
  CompactActionDialogFooter,
} from "@/components/forms/compact-action-dialog";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch-field";
import { Label } from "@/components/ui/label";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useTranslation } from "@/lib/i18n";
import type { useDepartmentWorkspace } from "@/lib/employee-departments/hooks/use-department-workspace";

export function EmployeeDepartmentDialog({ state }: { state: ReturnType<typeof useDepartmentWorkspace> }) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation();
  return (
    <Dialog open={state.open} onOpenChange={state.setOpen}>
      <CompactActionDialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(state.editing ? "employeeDepartments.edit" : "employeeDepartments.add")}
          </DialogTitle>
          <DialogDescription>{t("employeeDepartments.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={state.save} onKeyDown={handleEnterNavigation} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="department-name">
              {t("employeeDepartments.name")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="department-name"
              autoFocus
              required
              disabled={state.busy}
              aria-invalid={!!state.form.formState.errors.name}
              {...state.form.register("name")}
            />
            {state.form.formState.errors.name ? (
              <p role="alert" className="text-sm text-destructive">
                {t(state.form.formState.errors.name.message ?? "common.validation.required")}
              </p>
            ) : null}
          </div>
          <SwitchField
            id="department-active"
            label={t(
              state.form.watch("active") ? "employeeDepartments.active" : "employeeDepartments.inactive",
            )}
            checked={state.form.watch("active")}
            disabled={state.busy}
            onCheckedChange={(checked) =>
              state.form.setValue("active", checked, { shouldDirty: true, shouldValidate: true })
            }
          />
          <CompactActionDialogFooter
            error={state.error}
            isSubmitting={state.busy}
            submitLabel={t("common.actions.save")}
            submitType="submit"
            submitIcon={<Save className="h-4 w-4" />}
            onCancel={() => state.setOpen(false)}
          />
        </form>
      </CompactActionDialogContent>
    </Dialog>
  );
}
