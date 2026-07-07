"use client";

import { Container, Ship } from "lucide-react";
import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import {
  createEmptyContainerForm,
  type ContainerFormValues,
} from "@/lib/containers/types";

type ContainerFormProps = {
  initialValues?: ContainerFormValues;
  isEditing?: boolean;
  suggestedContainerName?: string;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: ContainerFormValues) => void;
  onCancel: () => void;
};

export function ContainerForm({
  initialValues,
  isEditing = false,
  suggestedContainerName,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: ContainerFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ContainerFormValues>(initialValues ?? createEmptyContainerForm());
  const [validationError, setValidationError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    const base = initialValues ?? createEmptyContainerForm();
    setValues(
      !isEditing && suggestedContainerName && !base.name
        ? { ...base, name: suggestedContainerName }
        : base,
    );
    setValidationError(null);
  }, [initialValues, isEditing, suggestedContainerName]);

  function updateField<K extends keyof ContainerFormValues>(key: K, value: ContainerFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setValidationError(null);
  }

  function getValidationError(): string | null {
    if (!values.name.trim()) {
      return t("containers.form.validation.nameRequired");
    }

    if (!values.booking.trim()) {
      return t("containers.form.validation.bookingRequired");
    }

    if (values.cost.trim()) {
      const cost = Number(values.cost);
      if (!Number.isFinite(cost) || cost < 0) {
        return t("containers.form.validation.costInvalid");
      }
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

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        <FormSection icon={Container} title={t("containers.form.sections.container")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name">
                {t("containers.form.fields.name")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder={t("containers.form.placeholders.name")}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="containerNumber">{t("containers.form.fields.containerNumber")}</Label>
              <Input
                id="containerNumber"
                value={values.containerNumber}
                onChange={(event) => updateField("containerNumber", event.target.value.toUpperCase())}
                placeholder={t("containers.form.placeholders.containerNumber")}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="booking">
                {t("containers.form.fields.booking")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="booking"
                value={values.booking}
                onChange={(event) => updateField("booking", event.target.value)}
                placeholder={t("containers.form.placeholders.booking")}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="sealNumber">{t("containers.form.fields.sealNumber")}</Label>
              <Input
                id="sealNumber"
                value={values.sealNumber}
                onChange={(event) => updateField("sealNumber", event.target.value)}
                placeholder={t("containers.form.placeholders.sealNumber")}
              />
            </div>
          </div>
        </FormSection>

        <FormSection icon={Ship} title={t("containers.form.sections.logistics")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="broker">{t("containers.form.fields.broker")}</Label>
              <Input
                id="broker"
                value={values.broker}
                onChange={(event) => updateField("broker", event.target.value)}
                placeholder={t("containers.form.placeholders.broker")}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="company">{t("containers.form.fields.company")}</Label>
              <Input
                id="company"
                value={values.company}
                onChange={(event) => updateField("company", event.target.value)}
                placeholder={t("containers.form.placeholders.company")}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cost">{t("containers.form.fields.cost")}</Label>
              <Input
                id="cost"
                type="number"
                min={0}
                step="0.01"
                value={values.cost}
                onChange={(event) => updateField("cost", event.target.value)}
                placeholder={t("containers.form.placeholders.cost")}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="departureDate">{t("containers.form.fields.departureDate")}</Label>
              <DateInput
                id="departureDate"
                value={values.departureDate}
                onChange={(event) => updateField("departureDate", event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="arrivalDate">{t("containers.form.fields.arrivalDate")}</Label>
              <DateInput
                id="arrivalDate"
                value={values.arrivalDate}
                onChange={(event) => updateField("arrivalDate", event.target.value)}
              />
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter
        error={validationError ?? externalError}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  );
}
