"use client";

import { MapPinned } from "lucide-react";

import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { LegacyRouteCitiesEditor } from "@/components/legacy-routes/legacy-route-cities-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import type { useLegacyRouteWorkspace } from "@/lib/legacy-routes/hooks/use-legacy-route-workspace";
import { useTranslation } from "@/lib/i18n";

export function LegacyRouteDialog({
  state,
}: {
  state: ReturnType<typeof useLegacyRouteWorkspace>;
}) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation();
  const { errors } = state.form.formState;
  const citiesError = errors.cities?.root ?? (errors.cities?.message ? errors.cities : undefined);
  const hasRowErrors = Array.isArray(errors.cities) && errors.cities.some((entry) => entry?.value);

  return (
    <Dialog open={state.open} onOpenChange={state.setOpen}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
          <DialogTitle>{t(state.editing ? "legacyRoutes.edit" : "legacyRoutes.add")}</DialogTitle>
          <DialogDescription>{t("legacyRoutes.description")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={state.save}
          onKeyDown={handleEnterNavigation}
          className="flex min-h-0 flex-1 flex-col"
        >
          <FormBody workflow isBusy={state.busy}>
            <FormSection
              variant="card"
              icon={MapPinned}
              title={t("legacyRoutes.form.details")}
              description={t("legacyRoutes.form.hint")}
            >
              <div className="space-y-1">
                <Label htmlFor="legacy-route-name">
                  {t("legacyRoutes.fields.name")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="legacy-route-name"
                  autoFocus
                  required
                  disabled={state.busy}
                  aria-invalid={!!errors.name}
                  {...state.form.register("name")}
                />
                {errors.name ? (
                  <p role="alert" className="text-sm text-destructive">
                    {t("legacyRoutes.form.errors.nameRequired")}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">
                    {t("legacyRoutes.fields.content")} <span className="text-destructive">*</span>
                  </p>
                  <p id="legacy-route-cities-hint" className="text-xs text-muted-foreground">
                    {t("legacyRoutes.form.citiesHint")}
                  </p>
                </div>
                <LegacyRouteCitiesEditor
                  form={state.form}
                  disabled={state.busy}
                  invalid={Boolean(citiesError)}
                  describedBy="legacy-route-cities-hint"
                />
                {citiesError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {t("legacyRoutes.form.errors.citiesRequired")}
                  </p>
                ) : hasRowErrors ? (
                  <p role="alert" className="text-sm text-destructive">
                    {t("legacyRoutes.form.errors.cityComma")}
                  </p>
                ) : null}
              </div>
            </FormSection>
          </FormBody>
          <FormFooter
            error={state.error}
            isSubmitting={state.busy}
            submitLabel={t("common.actions.save")}
            onCancel={() => state.setOpen(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
