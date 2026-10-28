"use client";

import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useWatch, type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import { isCheckPaymentMethod, requiresBankAccount, type AccountingLookup } from "@/lib/accounting/daily-income/types";
import { useTranslation } from "@/lib/i18n";
import { formatInventoryMinor } from "@/lib/inventory/display";
import { createEmptyReconciliationPayment } from "@/lib/inventory/pending-dispatches/reconciliation";
import { paymentsTotalMinor, soldRevenueMinor, type ReconciliationFormValues } from "@/lib/inventory/pending-dispatches/schemas";
import { cn } from "@/lib/utils";

type ReconcileDispatchPaymentsProps = {
  form: UseFormReturn<ReconciliationFormValues>;
  paymentMethods: AccountingLookup[];
  bankAccounts: ChartAccount[];
  loading: boolean;
};

/** Splits the sale revenue by payment method, with the fields each method needs. */
export function ReconcileDispatchPayments({ form, paymentMethods, bankAccounts, loading }: ReconcileDispatchPaymentsProps) {
  const { t } = useTranslation();
  const text = (key: string, values?: Record<string, string | number>) => t(`accounting.pendingInventory.dialog.${key}`, values);
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "payments", keyName: "fieldKey" });
  const payments = useWatch({ control: form.control, name: "payments" });
  const lines = useWatch({ control: form.control, name: "lines" });
  const errors = form.formState.errors.payments;
  const revenue = soldRevenueMinor(lines);
  const paid = paymentsTotalMinor(payments);
  const methodOptions = paymentMethods.map((method) => ({ value: String(method.id), label: method.displayName || method.name, keywords: [method.name] }));
  const accountOptions = bankAccounts.map((account) => ({ value: String(account.id), label: account.displayName || account.name, keywords: [account.name] }));

  return (
    <section aria-labelledby="reconcile-payments" className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="reconcile-payments" className="text-sm font-medium">{text("payments")}</h3>
          <p className="text-xs text-muted-foreground">{text("paymentsHint")}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => append(createEmptyReconciliationPayment())}>
          <Plus className="h-4 w-4" />
          {text("addPayment")}
        </Button>
      </div>
      {fields.map((field, index) => {
        const payment = payments[index];
        const paymentErrors = errors?.[index];
        const needsAccount = Boolean(payment?.paymentMethodId) && requiresBankAccount(payment?.paymentMethodName);
        const isCheck = isCheckPaymentMethod(payment?.paymentMethodName);
        const hasReference = Boolean(payment?.paymentMethodId) && needsAccount && !isCheck;
        const messages = [...new Set([
          paymentErrors?.paymentMethodId?.message,
          paymentErrors?.amount?.message,
          paymentErrors?.paymentAccountId?.message,
          paymentErrors?.checkNumber?.message,
        ].filter((message): message is string => Boolean(message)))];
        return (
          <fieldset key={field.fieldKey} className="min-w-0 space-y-2 rounded-md border bg-muted/20 p-3">
            <legend className="sr-only">{text("paymentNumber", { number: index + 1 })}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`reconcile-payment-${index}-method`} className="text-xs">{text("paymentMethod")}</Label>
                <Controller control={form.control} name={`payments.${index}.paymentMethodId`} render={({ field: methodField }) => (
                  <SearchableSelect
                    id={`reconcile-payment-${index}-method`}
                    options={methodOptions}
                    value={methodField.value}
                    loading={loading}
                    onValueChange={(value) => {
                      const method = paymentMethods.find((entry) => String(entry.id) === value);
                      methodField.onChange(value);
                      form.setValue(`payments.${index}.paymentMethodName`, method?.name ?? "");
                      if (!method || !requiresBankAccount(method.name)) form.setValue(`payments.${index}.paymentAccountId`, "");
                    }}
                    placeholder={text("selectPaymentMethod")}
                    searchPlaceholder={text("searchPaymentMethods")}
                    emptyMessage={text("noPaymentMethods")}
                    aria-invalid={Boolean(paymentErrors?.paymentMethodId)}
                    mobileSheet
                  />
                )} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`reconcile-payment-${index}-amount`} className="text-xs">{text("amount")}</Label>
                <Input id={`reconcile-payment-${index}-amount`} inputMode="decimal" placeholder="0.00" aria-invalid={Boolean(paymentErrors?.amount)} {...form.register(`payments.${index}.amount`)} />
              </div>
              {needsAccount ? (
                <div className="space-y-1">
                  <Label htmlFor={`reconcile-payment-${index}-account`} className="text-xs">{text("bankAccount")}</Label>
                  <Controller control={form.control} name={`payments.${index}.paymentAccountId`} render={({ field: accountField }) => (
                    <SearchableSelect
                      id={`reconcile-payment-${index}-account`}
                      options={accountOptions}
                      value={accountField.value}
                      loading={loading}
                      onValueChange={accountField.onChange}
                      placeholder={text("selectBankAccount")}
                      searchPlaceholder={text("searchBankAccounts")}
                      emptyMessage={text("noBankAccounts")}
                      aria-invalid={Boolean(paymentErrors?.paymentAccountId)}
                      mobileSheet
                    />
                  )} />
                </div>
              ) : null}
              {isCheck ? (
                <div className="space-y-1">
                  <Label htmlFor={`reconcile-payment-${index}-check`} className="text-xs">{text("checkNumber")}</Label>
                  <Input id={`reconcile-payment-${index}-check`} inputMode="numeric" aria-invalid={Boolean(paymentErrors?.checkNumber)} {...form.register(`payments.${index}.checkNumber`)} />
                </div>
              ) : null}
              {hasReference ? (
                <div className="space-y-1">
                  <Label htmlFor={`reconcile-payment-${index}-reference`} className="text-xs">{text("externalReference")}</Label>
                  <Input id={`reconcile-payment-${index}-reference`} maxLength={100} {...form.register(`payments.${index}.externalReferenceNumber`)} />
                </div>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                {messages.map((message) => <p key={message} role="alert" className="text-xs text-destructive">{t(message)}</p>)}
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => remove(index)} aria-label={text("removePayment")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </fieldset>
        );
      })}
      <p className={cn("text-sm", paid > revenue ? "text-destructive" : "text-muted-foreground")}>
        {text("paymentTotals", { paid: formatInventoryMinor(paid), revenue: formatInventoryMinor(revenue) })}
        {revenue > paid ? ` · ${text("onCredit", { amount: formatInventoryMinor(revenue - paid) })}` : ""}
      </p>
      {errors?.message || errors?.root?.message ? (
        <p role="alert" className="text-xs text-destructive">{t((errors.message ?? errors.root?.message) as string)}</p>
      ) : null}
    </section>
  );
}
