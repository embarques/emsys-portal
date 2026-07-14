"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Loader2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { RegisterInvoiceTransactionFields } from "@/components/accounting/register-invoice-transaction-fields";
import { FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { useChartAccounts } from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import {
  useAccountingPaymentMethods,
  useCreateDailyIncomeJournal,
} from "@/lib/accounting/daily-income/hooks";
import { createDailyIncomeJournalSchema } from "@/lib/accounting/daily-income/schemas";
import { getTransactionTypeOption } from "@/lib/accounting/daily-income/transaction-type-config";
import type {
  DailyIncomeJournal,
  DailyIncomeJournalValues,
  DailyIncomeStatement,
} from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { resolveLineTotal, type InvoiceFormValues } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { cn } from "@/lib/utils";

type Props = {
  statement: DailyIncomeStatement;
  invoice: InvoiceFormValues;
  onRegistered: (journal: DailyIncomeJournal) => void | Promise<void>;
};

function buildInitialValues(invoice: InvoiceFormValues): DailyIncomeJournalValues {
  const invoiceSubtotal = invoice.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0);
  const discount = Number(invoice.discount) || 0;
  const invoiceCost = Math.max(0, invoiceSubtotal - discount);

  return {
    transactionType: "INITIAL-PAYMENT",
    amount: 0,
    refNumber: "",
    description: "",
    invoiceNumber: invoice.invoiceNumber,
    invoiceCost,
    invoiceDiscount: discount,
    includeSender: Boolean(invoice.sender),
    senderId: invoice.sender?.id || undefined,
    senderName: invoice.sender?.name || undefined,
    includeReceiver: Boolean(invoice.receiver),
    receiverId: invoice.receiver?.id || undefined,
    receiverName: invoice.receiver?.name || undefined,
  };
}

export function InvoicePaymentTransactionForm({ statement, invoice, onRegistered }: Props) {
  const { t } = useTranslation();
  const formId = useId();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const currentUserQuery = useCurrentUser();
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc", active: true });
  const paymentMethodsQuery = useAccountingPaymentMethods(true);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, true);
  const createJournal = useCreateDailyIncomeJournal();

  const typeOption = getTransactionTypeOption("INITIAL-PAYMENT", t);
  const TypeIcon = typeOption.icon;
  const employees = useMemo(
    () => (employeesQuery.data?.items ?? []).filter((employee) => employee.active),
    [employeesQuery.data?.items],
  );
  const paymentMethods = paymentMethodsQuery.data ?? [];
  const bankAccounts = bankAccountsQuery.data?.items ?? [];

  const schema = useMemo(
    () =>
      createDailyIncomeJournalSchema({
        amountRequired: t("accounting.dailyIncome.form.validation.amountRequired"),
        amountNonNegative: t("accounting.dailyIncome.form.validation.amountNonNegative"),
        amountPositive: t("accounting.dailyIncome.form.validation.amountPositive"),
        refNumberTooLong: t("accounting.dailyIncome.form.validation.refNumberTooLong"),
        descriptionTooLong: t("accounting.dailyIncome.form.validation.descriptionTooLong"),
        costPositive: t("accounting.dailyIncome.form.validation.costPositive"),
        discountNonNegative: t("accounting.dailyIncome.form.validation.discountNonNegative"),
        zelleDateRequired: t("accounting.dailyIncome.form.validation.zelleDateRequired"),
        zelleNameRequired: t("accounting.dailyIncome.form.validation.zelleNameRequired"),
        bankAccountRequired: t("accounting.dailyIncome.form.validation.bankAccountRequired"),
        employeeRequired: t("accounting.dailyIncome.form.validation.employeeRequired"),
        invoiceRequired: t("accounting.dailyIncome.form.validation.invoiceRequired"),
        paymentMethodRequired: t("accounting.dailyIncome.form.validation.paymentMethodRequired"),
        amountExceedsCost: t("accounting.dailyIncome.form.validation.amountExceedsCost"),
        senderRequired: t("accounting.dailyIncome.form.validation.senderRequired"),
        receiverRequired: t("accounting.dailyIncome.form.validation.receiverRequired"),
        amountExceedsBalance: t("accounting.dailyIncome.form.validation.amountExceedsBalance"),
        accountRequired: t("accounting.dailyIncome.form.validation.accountRequired"),
        sourceAccountRequired: t("accounting.dailyIncome.form.validation.sourceAccountRequired"),
      }),
    [t],
  );

  const initialValues = useMemo(() => buildInitialValues(invoice), [invoice]);

  const {
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<DailyIncomeJournalValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  useEffect(() => {
    const user = currentUserQuery.data;
    if (!user || employees.length === 0 || getValues("employeeId")) return;
    const normalizedEmail = user.email.trim().toLowerCase();
    const employee =
      employees.find((item) => item.user?.id === user.id) ??
      employees.find((item) => item.email.trim().toLowerCase() === normalizedEmail) ??
      employees.find((item) => item.name.trim().toLowerCase() === user.name.trim().toLowerCase());
    if (!employee) return;
    setValue("employeeId", employee.id, { shouldValidate: true });
    setValue("employeeName", employee.name, { shouldValidate: true });
  }, [currentUserQuery.data, employees, getValues, setValue]);

  useEffect(() => {
    setValue(
      "description",
      t("invoices.wizard.dailyIncome.dialog.initialRegistrationDescription"),
      { shouldValidate: false },
    );
  }, [setValue, t]);

  async function submit(values: DailyIncomeJournalValues) {
    try {
      setSubmitError(null);
      const journal = await createJournal.mutateAsync({
        statement,
        values: {
          ...values,
          transactionType: "INITIAL-PAYMENT",
          invoiceNumber: invoice.invoiceNumber,
          invoiceCost: values.invoiceCost ?? initialValues.invoiceCost,
          invoiceDiscount: values.invoiceDiscount ?? initialValues.invoiceDiscount,
        },
      });
      if (!journal) {
        throw new Error(t("invoices.wizard.dailyIncome.dialog.registrationMissing"));
      }
      await onRegistered(journal);
    } catch (error) {
      setSubmitError(normalizeApiError(error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-card px-4 py-3 dark:border-blue-900">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            typeOption.iconBackgroundClassName,
          )}
        >
          <TypeIcon className={cn("size-4", typeOption.iconClassName)} />
        </span>
        <div>
          <p className="text-sm font-semibold">{typeOption.label}</p>
          <p className="text-xs text-muted-foreground">{typeOption.description}</p>
        </div>
      </div>

      <form id={formId} className="space-y-4" onSubmit={handleSubmit(submit)}>
        <FormSection title={typeOption.sectionTitle} required icon={FileText}>
          <RegisterInvoiceTransactionFields
            employees={employees}
            bankAccounts={bankAccounts}
            paymentMethods={paymentMethods}
            errors={errors}
            register={register}
            setValue={setValue}
            watch={watch}
          />
        </FormSection>

        {submitError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={createJournal.isPending || statement.status !== "OPEN"}>
            {createJournal.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {createJournal.isPending
              ? t("invoices.wizard.dailyIncome.dialog.registering")
              : t("invoices.wizard.dailyIncome.recordPaymentNow")}
          </Button>
        </div>
      </form>
    </div>
  );
}
