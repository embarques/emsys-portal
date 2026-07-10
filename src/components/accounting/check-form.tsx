"use client";

import { Banknote } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useTranslation } from "@/lib/i18n";
import {
  createEmptyCheckForm,
  type CheckFormValues,
  type CheckStatus,
} from "@/lib/accounting/checks/types";

type CheckFormProps = {
  initialValues?: CheckFormValues;
  isEditing?: boolean;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: CheckFormValues) => void;
  onCancel: () => void;
};

export function CheckForm({
  initialValues,
  isEditing = false,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: CheckFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<CheckFormValues>(initialValues ?? createEmptyCheckForm());
  const [validationError, setValidationError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();

  const statusOptions = useMemo(
    () =>
      (["outstanding", "cleared"] as CheckStatus[]).map((status) => ({
        value: status,
        label: t(`accounting.checks.status.${status}`),
      })),
    [t],
  );

  useEffect(() => {
    setValues(initialValues ?? createEmptyCheckForm());
    setValidationError(null);
  }, [initialValues]);

  function updateField<K extends keyof CheckFormValues>(key: K, value: CheckFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setValidationError(null);
  }

  function getValidationError(): string | null {
    if (!values.invoiceNumber.trim()) {
      return t("accounting.checks.form.validation.invoiceNumberRequired");
    }

    if (!values.receiptNumber.trim()) {
      return t("accounting.checks.form.validation.receiptNumberRequired");
    }

    if (!values.createdBy.trim()) {
      return t("accounting.checks.form.validation.createdByRequired");
    }

    if (values.status === "cleared") {
      if (!values.depositedAt.trim() || !values.depositedOn.trim() || !values.depositedBy.trim()) {
        return t("accounting.checks.form.validation.depositRequired");
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

  const showDepositFields = values.status === "cleared";

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={Banknote} title={t("accounting.checks.form.sections.details")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="invoiceNumber">
                {t("accounting.checks.form.fields.invoiceNumber")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invoiceNumber"
                value={values.invoiceNumber}
                placeholder={t("accounting.checks.form.placeholders.invoiceNumber")}
                onChange={(event) => updateField("invoiceNumber", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="receiptNumber">
                {t("accounting.checks.form.fields.receiptNumber")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="receiptNumber"
                value={values.receiptNumber}
                placeholder={t("accounting.checks.form.placeholders.receiptNumber")}
                onChange={(event) => updateField("receiptNumber", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">{t("accounting.checks.form.fields.status")}</Label>
              <SearchableSelect
                value={values.status}
                onValueChange={(value) => updateField("status", value as CheckStatus)}
                options={statusOptions}
                placeholder={t("accounting.checks.form.fields.status")}
                searchPlaceholder={t("common.table.search")}
                emptyMessage={t("accounting.checks.form.selectEmpty")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="createdBy">
                {t("accounting.checks.form.fields.createdBy")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="createdBy"
                value={values.createdBy}
                placeholder={t("accounting.checks.form.placeholders.createdBy")}
                onChange={(event) => updateField("createdBy", event.target.value)}
              />
            </div>
          </div>
        </FormSection>

        {showDepositFields ? (
          <FormSection icon={Banknote} title={t("accounting.checks.form.sections.deposit")}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="depositedAt">
                  {t("accounting.checks.form.fields.depositedAt")} <span className="text-destructive">*</span>
                </Label>
                <DateInput
                  id="depositedAt"
                  value={values.depositedAt}
                  onChange={(event) => updateField("depositedAt", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="depositedOn">
                  {t("accounting.checks.form.fields.depositedOn")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="depositedOn"
                  value={values.depositedOn}
                  placeholder={t("accounting.checks.form.placeholders.depositedOn")}
                  onChange={(event) => updateField("depositedOn", event.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="depositedBy">
                  {t("accounting.checks.form.fields.depositedBy")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="depositedBy"
                  value={values.depositedBy}
                  placeholder={t("accounting.checks.form.placeholders.depositedBy")}
                  onChange={(event) => updateField("depositedBy", event.target.value)}
                />
              </div>
            </div>
          </FormSection>
        ) : null}
      </FormBody>

      <FormFooter
        error={validationError ?? externalError}
        isSubmitting={isSubmitting}
        submitLabel={isEditing ? t("common.actions.saveChanges") : t("common.actions.save")}
        onCancel={onCancel}
      />
    </form>
  );
}
