"use client";

import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { createEmptyPredefinedRouteCity, type PredefinedRouteFormValues } from "@/lib/predefined-routes/types";
import { normalizeRouteCities, splitRouteCityInput } from "@/lib/predefined-routes/utils/route-cities";

type PredefinedRouteCitiesEditorProps = {
  form: UseFormReturn<PredefinedRouteFormValues>;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

/** Add, edit and remove the cities / ZIP codes a predefined route covers, one row each. */
export function PredefinedRouteCitiesEditor({ form, disabled, invalid, describedBy }: PredefinedRouteCitiesEditorProps) {
  const { t } = useTranslation();
  const { fields, append, insert, remove } = useFieldArray({ control: form.control, name: "cities" });
  const entries = useWatch({ control: form.control, name: "cities" }) ?? [];
  const filledCount = normalizeRouteCities(entries.map((entry) => entry?.value ?? "")).length;
  const rowErrors = form.formState.errors.cities;

  /** Typing or pasting commas splits the text into separate rows so each entry stays a single city or ZIP. */
  function splitEntry(index: number, raw: string) {
    const { current, added } = splitRouteCityInput(raw);
    form.setValue(`cities.${index}.value`, current, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    if (!added.length) return;
    insert(
      index + 1,
      added.map((value) => ({ value })),
      { focusName: `cities.${index + added.length}.value` },
    );
  }

  function removeEntry(index: number) {
    if (fields.length <= 1) {
      form.setValue("cities.0.value", "", { shouldDirty: true });
      form.setFocus("cities.0.value");
      return;
    }
    remove(index);
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="-m-1 max-h-72 space-y-2 overflow-y-auto p-1" aria-describedby={describedBy}>
        {fields.map((field, index) => {
          const registration = form.register(`cities.${index}.value`);
          const rowInvalid = Boolean(rowErrors?.[index]?.value);
          return (
            <li key={field.id} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
              <Input
                {...registration}
                id={`predefined-route-city-${index}`}
                disabled={disabled}
                autoComplete="off"
                placeholder={t("predefinedRoutes.form.cityPlaceholder")}
                aria-label={t("predefinedRoutes.form.cityAria", { index: index + 1 })}
                aria-invalid={invalid || rowInvalid}
                className="min-w-0 flex-1"
                onChange={(event) => {
                  if (event.target.value.includes(",")) {
                    splitEntry(index, event.target.value);
                    return;
                  }
                  void registration.onChange(event);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || (fields.length <= 1 && !entries[0]?.value)}
                title={t("predefinedRoutes.form.removeCity")}
                aria-label={t("predefinedRoutes.form.removeCityAria", { index: index + 1 })}
                className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeEntry(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {t("predefinedRoutes.form.cityCount", { count: filledCount })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
          onClick={() => append(createEmptyPredefinedRouteCity())}
        >
          <Plus className="size-4" />
          {t("predefinedRoutes.form.addCity")}
        </Button>
      </div>
    </div>
  );
}
