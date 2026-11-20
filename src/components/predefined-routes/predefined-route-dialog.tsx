"use client";

import { Save } from "lucide-react";

import {
  CompactActionDialogContent,
  CompactActionDialogFooter,
} from "@/components/forms/compact-action-dialog";
import { PredefinedRouteCitiesEditor } from "@/components/predefined-routes/predefined-route-cities-editor";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import type { usePredefinedRouteWorkspace } from "@/lib/predefined-routes/hooks/use-predefined-route-workspace";
import { useTranslation } from "@/lib/i18n";

export function PredefinedRouteDialog({
  state,
}: {
  state: ReturnType<typeof usePredefinedRouteWorkspace>;
}) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation();
  const { errors } = state.form.formState;
  const citiesError = errors.cities?.root ?? (errors.cities?.message ? errors.cities : undefined);
  const hasRowErrors = Array.isArray(errors.cities) && errors.cities.some((entry) => entry?.value);

  return (
    <Dialog open={state.open} onOpenChange={state.setOpen}>
      <CompactActionDialogContent centerInWorkspace className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t(state.editing ? "predefinedRoutes.edit" : "predefinedRoutes.add")}</DialogTitle>
          <DialogDescription>{t("predefinedRoutes.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={state.save} onKeyDown={handleEnterNavigation} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="predefined-route-name">
              {t("predefinedRoutes.fields.name")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="predefined-route-name"
              autoFocus
              required
              disabled={state.busy}
              aria-invalid={!!errors.name}
              {...state.form.register("name")}
            />
            {errors.name ? (
              <p role="alert" className="text-sm text-destructive">
                {t("predefinedRoutes.form.errors.nameRequired")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">
                {t("predefinedRoutes.fields.content")} <span className="text-destructive">*</span>
              </p>
              <p id="predefined-route-cities-hint" className="text-xs text-muted-foreground">
                {t("predefinedRoutes.form.citiesHint")}
              </p>
            </div>
            <PredefinedRouteCitiesEditor
              form={state.form}
              disabled={state.busy}
              invalid={Boolean(citiesError)}
              describedBy="predefined-route-cities-hint"
            />
            {citiesError ? (
              <p role="alert" className="text-sm text-destructive">
                {t("predefinedRoutes.form.errors.citiesRequired")}
              </p>
            ) : hasRowErrors ? (
              <p role="alert" className="text-sm text-destructive">
                {t("predefinedRoutes.form.errors.cityComma")}
              </p>
            ) : null}
          </div>

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
