"use client";

import { Banknote } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { formatAccountingMoney } from "@/lib/accounting/display";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import {
  checkStatusI18nKey,
  createEmptyCheckForm,
  parseCheckPaymentAmount,
  type CheckFormValues,
  type CheckStatus,
} from "@/lib/accounting/checks/types";
import { useTranslation } from "@/lib/i18n";
import { useInvoiceSearch, useInvoices } from "@/lib/invoices/hooks/use-invoices";
import {
  createInvoiceSearchFilter,
  DEFAULT_INVOICE_LIST_PARAMS,
} from "@/lib/invoices/types";

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
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const handleEnterNavigation = useFormEnterNavigation();
  const debouncedInvoiceQuery = useDebouncedValue(invoiceQuery.trim(), 300);
  const invoiceSearch = useInvoiceSearch(createInvoiceSearchFilter(debouncedInvoiceQuery), {
    enabled: Boolean(debouncedInvoiceQuery),
    limit: 20,
  });
  const recentInvoices = useInvoices(
    { ...DEFAULT_INVOICE_LIST_PARAMS, limit: 20 },
    { enabled: !debouncedInvoiceQuery },
  );
  const invoiceResults = debouncedInvoiceQuery
    ? (invoiceSearch.data?.items ?? [])
    : (recentInvoices.data?.items ?? []);
  const invoiceOptions = useMemo(
    () =>
      withPinnedSelectOption(
        invoiceResults.map((invoice) => ({
          value: invoice.invoiceId,
          label: invoice.invoiceNumber,
          description: invoice.sender?.name,
          keywords: [invoice.invoiceNumber, invoice.sender?.name ?? ""],
        })),
        values.invoiceId,
        values.invoiceNumber,
      ),
    [invoiceResults, values.invoiceId, values.invoiceNumber],
  );

  useEffect(() => {
    setValues(initialValues ?? createEmptyCheckForm());
    setValidationError(null);
    setInvoiceQuery("");
  }, [initialValues]);

  function updateField<K extends keyof CheckFormValues>(key: K, value: CheckFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setValidationError(null);
  }

  function getValidationError(): string | null {
    if (!values.invoiceId.trim()) {
      return t("accounting.checks.form.validation.invoiceRequired");
    }

    if (!values.checkNumber.trim()) {
      return t("accounting.checks.form.validation.checkNumberRequired");
    }

    if (parseCheckPaymentAmount(values.paymentAmount) == null) {
      return t("accounting.checks.form.validation.paymentAmountRequired");
    }

    if (!values.datePosted.trim()) {
      return t("accounting.checks.form.validation.datePostedRequired");
    }

    if (values.status === "CLEARED" && !values.clearedAt.trim()) {
      return t("accounting.checks.form.validation.clearedAtRequired");
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

  const statusOptions: Array<{ value: CheckStatus; label: string }> = [
    { value: "OUTSTANDING", label: t("accounting.checks.status.outstanding") },
    { value: "CLEARED", label: t("accounting.checks.status.cleared") },
  ];

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={Banknote} title={t("accounting.checks.form.sections.details")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="check-invoice">
                {t("accounting.checks.form.fields.invoice")} <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="check-invoice"
                value={values.invoiceId}
                onValueChange={(next) => {
                  const invoice = invoiceResults.find((item) => item.invoiceId === next);
                  updateField("invoiceId", next);
                  updateField("invoiceNumber", invoice?.invoiceNumber ?? values.invoiceNumber);
                  if (invoice && !values.paymentAmount.trim()) {
                    const remaining = invoice.balance ?? Math.max(0, (invoice.cost ?? 0) - invoice.amountPaid);
                    if (remaining > 0) {
                      updateField("paymentAmount", String(remaining));
                    }
                  }
                }}
                onSearchChange={setInvoiceQuery}
                manualFiltering
                loading={invoiceSearch.isFetching || recentInvoices.isFetching}
                placeholder={t("accounting.checks.form.placeholders.invoice")}
                searchPlaceholder={t("accounting.checks.form.placeholders.searchInvoices")}
                emptyMessage={t("accounting.checks.form.selectEmpty")}
                options={invoiceOptions}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="checkNumber">
                {t("accounting.checks.form.fields.checkNumber")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="checkNumber"
                value={values.checkNumber}
                placeholder={t("accounting.checks.form.placeholders.checkNumber")}
                onChange={(event) => updateField("checkNumber", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paymentAmount">
                {t("accounting.checks.form.fields.paymentAmount")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="paymentAmount"
                inputMode="decimal"
                value={values.paymentAmount}
                placeholder={formatAccountingMoney(0)}
                onChange={(event) => updateField("paymentAmount", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="datePosted">
                {t("accounting.checks.form.fields.datePosted")} <span className="text-destructive">*</span>
              </Label>
              <DateInput
                id="datePosted"
                value={values.datePosted}
                onChange={(event) => updateField("datePosted", event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="referenceNumber">{t("accounting.checks.form.fields.referenceNumber")}</Label>
              <Input
                id="referenceNumber"
                value={values.refNumber}
                placeholder={t("accounting.checks.form.placeholders.referenceNumber")}
                onChange={(event) => updateField("refNumber", event.target.value)}
              />
            </div>
            {isEditing ? (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="check-status">{t("accounting.checks.form.fields.status")}</Label>
                <SearchableSelect
                  id="check-status"
                  value={values.status}
                  onValueChange={(next) => {
                    const status = next === "CLEARED" ? "CLEARED" : "OUTSTANDING";
                    updateField("status", status);
                    if (status === "CLEARED" && !values.clearedAt.trim()) {
                      updateField("clearedAt", values.datePosted);
                    }
                    if (status === "OUTSTANDING") {
                      updateField("clearedAt", "");
                    }
                  }}
                  options={statusOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  placeholder={t(`accounting.checks.status.${checkStatusI18nKey(values.status)}`)}
                />
              </div>
            ) : null}
          </div>
        </FormSection>

        {values.status === "CLEARED" ? (
          <FormSection icon={Banknote} title={t("accounting.checks.form.sections.clearance")}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="clearedAt">
                  {t("accounting.checks.form.fields.clearedAt")} <span className="text-destructive">*</span>
                </Label>
                <DateInput
                  id="clearedAt"
                  value={values.clearedAt}
                  onChange={(event) => updateField("clearedAt", event.target.value)}
                />
              </div>
              <p className="self-end text-sm text-muted-foreground sm:col-span-1">
                {t("accounting.checks.form.clearanceHint")}
              </p>
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
