"use client";

import { Plus, Target, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";

import { ComplaintEmployeeSelect } from "@/components/complaints/complaint-employee-select";
import { FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { complaintTargetKindLabel } from "@/lib/complaints/display";
import {
  COMPLAINT_TARGET_KINDS,
  createEmptyComplaintTarget,
  type ComplaintTargetKind,
  type ComplaintTargetsFormValues,
} from "@/lib/complaints/types";
import { useTranslation } from "@/lib/i18n";

export function ComplaintFieldError({ message }: { message?: string }) {
  const { t } = useTranslation();
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {t(message)}
    </p>
  );
}

export function ComplaintRequiredMark() {
  return <span className="text-destructive"> *</span>;
}

/** Editable complaint targets (1–30) for any form that keeps them under `targets`. */
export function ComplaintTargetsSection<T extends ComplaintTargetsFormValues>({
  form: anyForm,
  busy,
  canPickEmployees,
}: {
  form: UseFormReturn<T>;
  busy: boolean;
  canPickEmployees: boolean;
}) {
  // react-hook-form cannot type `targets.*` paths on a generic form; every caller stores them at `targets`.
  const form = anyForm as unknown as UseFormReturn<ComplaintTargetsFormValues>;
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "targets" });
  const targets = useWatch({ control: form.control, name: "targets" });
  const errors = form.formState.errors.targets;
  const kinds = COMPLAINT_TARGET_KINDS.filter((kind) => kind !== "employee" || canPickEmployees);
  const kindOptions = kinds.map((kind) => ({ value: kind, label: complaintTargetKindLabel(t, kind) }));

  return (
    <FormSection
      variant="card"
      icon={Target}
      title={t("complaints.form.sections.targets")}
      description={t("complaints.form.targetsHint")}
      required
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || fields.length >= 30}
          onClick={() => append(createEmptyComplaintTarget(canPickEmployees ? "employee" : "other"))}
        >
          <Plus className="size-4" />
          {t("complaints.form.addTarget")}
        </Button>
      }
    >
      <div className="space-y-3">
        {fields.map((field, index) => {
          const kind = targets?.[index]?.kind ?? field.kind;
          const rowErrors = errors?.[index];
          return (
            <div key={field.id} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[10rem_1fr_auto]">
              <div className="space-y-1">
                <Label htmlFor={`complaint-target-kind-${index}`}>{t("complaints.form.targetKind")}</Label>
                <Controller
                  control={form.control}
                  name={`targets.${index}.kind`}
                  render={({ field: kindField }) => (
                    <SearchableSelect
                      id={`complaint-target-kind-${index}`}
                      options={kindOptions}
                      value={kindField.value}
                      onValueChange={(next) => {
                        kindField.onChange(next as ComplaintTargetKind);
                        form.setValue(`targets.${index}.employeeId`, "");
                        form.setValue(`targets.${index}.label`, "");
                      }}
                      disabled={busy}
                      placeholder={t("complaints.form.targetKind")}
                      searchPlaceholder={t("complaints.form.searchOptions")}
                      emptyMessage={t("complaints.form.noOptions")}
                    />
                  )}
                />
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor={`complaint-target-value-${index}`}>
                    {kind === "employee" ? t("complaints.form.targetEmployee") : t("complaints.form.targetLabel")}
                    <ComplaintRequiredMark />
                  </Label>
                  {kind === "employee" ? (
                    <Controller
                      control={form.control}
                      name={`targets.${index}.employeeId`}
                      render={({ field: employeeField }) => (
                        <ComplaintEmployeeSelect
                          id={`complaint-target-value-${index}`}
                          value={employeeField.value}
                          onChange={employeeField.onChange}
                          disabled={busy}
                          invalid={Boolean(rowErrors?.employeeId)}
                        />
                      )}
                    />
                  ) : (
                    <Input
                      id={`complaint-target-value-${index}`}
                      placeholder={t(`complaints.form.targetLabelPlaceholders.${kind}`)}
                      disabled={busy}
                      aria-invalid={Boolean(rowErrors?.label)}
                      {...form.register(`targets.${index}.label`)}
                    />
                  )}
                  <ComplaintFieldError message={rowErrors?.employeeId?.message ?? rowErrors?.label?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`complaint-target-note-${index}`}>{t("complaints.form.targetNote")}</Label>
                  <Input
                    id={`complaint-target-note-${index}`}
                    disabled={busy}
                    {...form.register(`targets.${index}.note`)}
                  />
                  <ComplaintFieldError message={rowErrors?.note?.message} />
                </div>
              </div>
              <div className="flex items-start sm:pt-6">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("complaints.form.removeTarget")}
                  disabled={busy || fields.length <= 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
        <ComplaintFieldError message={errors?.message ?? errors?.root?.message} />
      </div>
    </FormSection>
  );
}
