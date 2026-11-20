"use client";

import { Plus, Save } from "lucide-react";

import {
  CompactActionDialogBody,
  CompactActionDialogContent,
  CompactActionDialogFooter,
  CompactActionDialogHeader,
} from "@/components/forms/compact-action-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SwitchField } from "@/components/ui/switch-field";
import { Label } from "@/components/ui/label";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useTranslation } from "@/lib/i18n";
import type { useTitleWorkspace } from "@/lib/employee-titles/hooks/use-title-workspace";

export function EmployeeTitleDialog({ state }: { state: ReturnType<typeof useTitleWorkspace> }) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation();
  return (
    <Dialog open={state.open} onOpenChange={state.setOpen}>
      <CompactActionDialogContent className="sm:max-w-lg">
        <CompactActionDialogHeader
          icon={state.editing ? Save : Plus}
          title={t(state.editing ? "employeeTitles.edit" : "employeeTitles.add")}
          description={t("employeeTitles.description")}
        />
        <form onSubmit={state.save} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
          <CompactActionDialogBody>
          <div className="space-y-1">
            <Label htmlFor="title-name">
              {t("employeeTitles.name")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title-name"
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
            id="title-active"
            label={t(state.form.watch("active") ? "employeeTitles.active" : "employeeTitles.inactive")}
            checked={state.form.watch("active")}
            disabled={state.busy}
            onCheckedChange={(checked) =>
              state.form.setValue("active", checked, { shouldDirty: true, shouldValidate: true })
            }
          />
          </CompactActionDialogBody>
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
