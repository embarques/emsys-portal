"use client";

import { ScanBarcode, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { useTranslation } from "@/lib/i18n";
import { useBarcodeStatusOptions } from "@/lib/labels/hooks/use-label-display";
import { createEmptyBarcodeForm, type BarcodeFormValues } from "@/lib/barcodes/types";

type BarcodeFormProps = {
  initialValues?: BarcodeFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: BarcodeFormValues) => void;
  onCancel: () => void;
};

export function BarcodeForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: BarcodeFormProps) {
  const { t } = useTranslation();
  const containersQuery = useContainerPicker(200);
  const containers = containersQuery.data?.items ?? [];
  const barcodeStatusOptions = useBarcodeStatusOptions();
  const [values, setValues] = useState<BarcodeFormValues>(initialValues ?? createEmptyBarcodeForm());
  const [validationError, setValidationError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();

  const statusOptions = useMemo(
    () =>
      barcodeStatusOptions.map((option) => ({
        value: String(option.id),
        label: option.label,
        keywords: [option.name],
      })),
    [barcodeStatusOptions],
  );

  const containerOptions = useMemo(
    () =>
      containers.map((container) => ({
        value: String(container.id),
        label: formatContainerLabel(container),
        keywords: [container.name, container.containerNumber, container.booking],
      })),
    [containers],
  );

  useEffect(() => {
    setValues(initialValues ?? createEmptyBarcodeForm());
    setValidationError(null);
  }, [initialValues]);

  function updateField<K extends keyof BarcodeFormValues>(key: K, value: BarcodeFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setValidationError(null);
  }

  function getValidationError(): string | null {
    if (!values.number.trim()) {
      return t("barcodes.form.validation.numberRequired");
    }

    if (!values.statusId.trim()) {
      return t("barcodes.form.validation.statusRequired");
    }

    return null;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const error = getValidationError();
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    onSubmit(values);
  }

  const displayError = validationError ?? externalError;

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={ScanBarcode} title={t("barcodes.form.sections.barcode")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="number">
                {t("barcodes.form.fields.number")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="number"
                value={values.number}
                onChange={(event) => updateField("number", event.target.value)}
                placeholder={t("barcodes.form.placeholders.number")}
                className="font-mono text-xs"
                required
                readOnly={isEditing}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="status">
                {t("barcodes.form.fields.status")} <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="status"
                value={values.statusId}
                onValueChange={(next) => updateField("statusId", next)}
                placeholder={t("barcodes.form.placeholders.status")}
                searchPlaceholder={t("barcodes.form.search.statuses")}
                options={statusOptions}
              />
            </div>
          </div>
        </FormSection>

        <FormSection icon={Truck} title={t("barcodes.form.sections.assignment")}>
          <div className="space-y-1">
            <Label htmlFor="container">{t("barcodes.form.fields.container")}</Label>
            <SearchableSelect
              id="container"
              value={values.containerId}
              onValueChange={(next) => updateField("containerId", next)}
              placeholder={t("barcodes.form.placeholders.container")}
              searchPlaceholder={t("barcodes.form.search.containers")}
              options={containerOptions}
              loading={containersQuery.isLoading}
            />
          </div>
        </FormSection>
      </FormBody>

      <FormFooter
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        error={displayError}
        onCancel={onCancel}
      />
    </form>
  );
}
