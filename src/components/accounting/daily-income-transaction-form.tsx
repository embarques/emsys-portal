"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";

import { RegisterInvoiceTransactionFields } from "@/components/accounting/register-invoice-transaction-fields";
import { FormBody, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getTransactionTypeOption, getTransactionFormSecondFieldId } from "@/lib/accounting/daily-income/transaction-type-config";
import { dailyIncomeJournalSchema } from "@/lib/accounting/daily-income/schemas";
import { isZellePaymentMethod, requiresBankAccount, type AccountingLookup, type ChartAccount, type DailyIncomeJournalValues, type JournalTransactionType } from "@/lib/accounting/daily-income/types";
import { formatAccountingMoney } from "@/lib/accounting/display";
import type { Employee } from "@/lib/employees/types";
import { getInvoiceBalanceAmount, getInvoiceTotal, type Invoice } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

type Props = {
  transactionType: JournalTransactionType;
  initialValues: DailyIncomeJournalValues;
  employees: Employee[];
  accounts: ChartAccount[];
  bankAccounts: ChartAccount[];
  invoices: Invoice[];
  paymentMethods: AccountingLookup[];
  formId: string;
  showTypeSummary?: boolean;
  focusSecondFieldSignal?: number;
  onSubmit: (values: DailyIncomeJournalValues) => void | Promise<void>;
};

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="text-destructive"> *</span>
    </Label>
  );
}

export function DailyIncomeTransactionForm({
  transactionType,
  initialValues,
  employees,
  accounts,
  bankAccounts,
  invoices,
  paymentMethods,
  formId,
  showTypeSummary = false,
  focusSecondFieldSignal,
  onSubmit,
}: Props) {
  const typeOption = getTransactionTypeOption(transactionType);
  const TypeIcon = typeOption.icon;

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<DailyIncomeJournalValues>({
    resolver: zodResolver(dailyIncomeJournalSchema),
    defaultValues: { ...initialValues, transactionType },
  });

  useEffect(() => {
    reset({ ...initialValues, transactionType });
  }, [initialValues, reset, transactionType]);

  useEffect(() => {
    if (!focusSecondFieldSignal) return;
    const fieldId = getTransactionFormSecondFieldId(transactionType);
    const timer = window.setTimeout(() => {
      document.getElementById(fieldId)?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusSecondFieldSignal, transactionType]);

  const type = watch("transactionType");
  const employeeId = watch("employeeId");
  const invoiceId = watch("invoiceId");
  const accountId = watch("accountId");
  const paymentAccountId = watch("paymentAccountId");
  const sourceAccountId = watch("sourceAccountId");
  const paymentMethodId = watch("paymentMethodId");
  const paymentMethodName = watch("paymentMethodName");
  const isZelle = isZellePaymentMethod(paymentMethodName);
  const needsBankAccount = requiresBankAccount(paymentMethodName);
  const selectedInvoice = invoiceId ? invoices.find((item) => item.invoiceId === invoiceId) : undefined;
  const invoiceOptions = useMemo(
    () =>
      invoices.map((invoice) => {
        const phones = [...(invoice.sender?.phones ?? []), ...(invoice.receiver?.phones ?? [])];
        const phoneKeywords = phones.flatMap((phone) =>
          [phone.number, phone.displayNumber].filter((value): value is string => Boolean(value)),
        );
        const descriptionLines = [
          invoice.sender?.name ? `Sender: ${invoice.sender.name}` : null,
          invoice.receiver?.name ? `Receiver: ${invoice.receiver.name}` : null,
        ].filter((line): line is string => Boolean(line));
        return {
          value: invoice.invoiceId,
          label: invoice.invoiceNumber,
          descriptionLines,
          keywords: [
            invoice.invoiceNumber,
            invoice.sender?.name ?? "",
            invoice.receiver?.name ?? "",
            ...phoneKeywords,
          ].filter(Boolean),
        };
      }),
    [invoices],
  );
  const needsExistingInvoice = ["PAYMENT", "DISCOUNT", "SURCHARGE"].includes(type);
  const isRegisterInvoice = type === "INITIAL-PAYMENT";
  const needsAccount = ["EXPENSE", "SALES", "TRANSFER", "LOAN"].includes(type);
  const needsPaymentMethod = needsExistingInvoice || isRegisterInvoice || type === "SALES";
  const needsSourceAccount = type === "TRANSFER" || type === "EXPENSE" || type === "LOAN";

  useEffect(() => {
    if (!needsBankAccount || bankAccounts.some((account) => account.id === paymentAccountId) || !bankAccounts[0]) return;
    const account = bankAccounts[0];
    setValue("paymentAccountId", account.id, { shouldValidate: true });
    setValue("paymentAccountName", account.displayName);
    setValue("paymentAccountType", account.type);
  }, [bankAccounts, needsBankAccount, paymentAccountId, setValue]);

  return (
    <form id={formId} onSubmit={handleSubmit((values) => onSubmit(values))} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        {showTypeSummary ? (
          <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-card px-4 py-3">
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
        ) : null}

        <FormSection title={typeOption.sectionTitle} required>
          {isRegisterInvoice ? (
            <RegisterInvoiceTransactionFields
              employees={employees}
              bankAccounts={bankAccounts}
              paymentMethods={paymentMethods}
              errors={errors}
              register={register}
              setValue={setValue}
              watch={watch}
            />
          ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {needsExistingInvoice ? (
              <div className="space-y-2 sm:col-span-2">
                <RequiredLabel htmlFor="journal-invoice">Invoice</RequiredLabel>
                <SearchableSelect
                  id="journal-invoice"
                  value={invoiceId ?? ""}
                  onValueChange={(next) => {
                    const invoice = invoices.find((item) => item.invoiceId === next);
                    setValue("invoiceId", invoice?.invoiceId ?? "", { shouldValidate: true });
                    setValue("invoiceNumber", invoice?.invoiceNumber ?? "");
                    setValue(
                      "invoiceBalance",
                      invoice ? getInvoiceBalanceAmount(invoice) : undefined,
                      { shouldValidate: true },
                    );
                  }}
                  placeholder="Select invoice"
                  searchPlaceholder="Search by invoice #, sender or receiver phone…"
                  options={invoiceOptions}
                />
                {errors.invoiceId ? (
                  <p className="text-sm text-destructive">{errors.invoiceId.message}</p>
                ) : null}
                {selectedInvoice ? (
                  <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-blue-100 bg-card px-3 py-2 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Total</p>
                      <p className="font-medium">{formatAccountingMoney(getInvoiceTotal(selectedInvoice))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Discount</p>
                      <p className="font-medium">{formatAccountingMoney(selectedInvoice.discount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p className="font-medium">{formatAccountingMoney(selectedInvoice.amountPaid)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className="font-medium">{formatAccountingMoney(getInvoiceBalanceAmount(selectedInvoice))}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <RequiredLabel htmlFor="journal-employee">Employee</RequiredLabel>
              <select
                id="journal-employee"
                className={selectClassName}
                value={employeeId ?? ""}
                onChange={(event) => {
                  const employee = employees.find((item) => String(item.id) === event.target.value);
                  setValue("employeeId", employee?.id, { shouldValidate: true });
                  setValue("employeeName", employee?.name ?? "");
                }}
              >
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
              {errors.employeeId ? (
                <p className="text-sm text-destructive">{errors.employeeId.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal-reference">Reference number</Label>
              <Input id="journal-reference" placeholder="Enter reference number" {...register("refNumber")} />
            </div>

            {needsAccount ? (
              <div className="space-y-2">
                <RequiredLabel htmlFor="journal-account">Account</RequiredLabel>
                <select
                  id="journal-account"
                  className={selectClassName}
                  value={accountId ?? ""}
                  onChange={(event) => {
                    const account = accounts.find((item) => item.id === Number(event.target.value));
                    setValue("accountId", account?.id, { shouldValidate: true });
                    setValue("accountName", account?.displayName ?? "");
                    setValue("accountType", account?.type);
                  }}
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.displayName}
                    </option>
                  ))}
                </select>
                {errors.accountId ? (
                  <p className="text-sm text-destructive">{errors.accountId.message}</p>
                ) : null}
              </div>
            ) : null}

            {needsSourceAccount ? (
              <div className="space-y-2">
                <RequiredLabel htmlFor="journal-source">Source account</RequiredLabel>
                <select
                  id="journal-source"
                  className={selectClassName}
                  value={sourceAccountId ?? ""}
                  onChange={(event) => {
                    const account = accounts.find((item) => item.id === Number(event.target.value));
                    setValue("sourceAccountId", account?.id, { shouldValidate: true });
                    setValue("sourceAccountName", account?.displayName ?? "");
                    setValue("sourceAccountType", account?.type);
                  }}
                >
                  <option value="">Select source account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.displayName}
                    </option>
                  ))}
                </select>
                {errors.sourceAccountId ? (
                  <p className="text-sm text-destructive">{errors.sourceAccountId.message}</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              {needsPaymentMethod ? (
                <RequiredLabel htmlFor="journal-payment">Payment method</RequiredLabel>
              ) : (
                <Label htmlFor="journal-payment">Payment method</Label>
              )}
              <select
                id="journal-payment"
                className={selectClassName}
                value={paymentMethodId ?? ""}
                onChange={(event) => {
                  const method = paymentMethods.find((item) => item.id === Number(event.target.value));
                  setValue("paymentMethodId", method?.id, { shouldValidate: true });
                  setValue("paymentMethodName", method?.name ?? "", { shouldValidate: true });
                  if (!isZellePaymentMethod(method?.name)) {
                    setValue("zelleTransactionDate", undefined, { shouldValidate: true });
                    setValue("zelleTransactionName", undefined, { shouldValidate: true });
                  }
                }}
              >
                <option value="">Select payment method</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </select>
              {errors.paymentMethodId ? (
                <p className="text-sm text-destructive">{errors.paymentMethodId.message}</p>
              ) : null}
            </div>

            {needsBankAccount ? (
              <div className="space-y-2">
                <RequiredLabel htmlFor="journal-bank-account">Bank account</RequiredLabel>
                <select
                  id="journal-bank-account"
                  className={selectClassName}
                  value={paymentAccountId ?? ""}
                  onChange={(event) => {
                    const account = bankAccounts.find((item) => item.id === Number(event.target.value));
                    setValue("paymentAccountId", account?.id, { shouldValidate: true });
                    setValue("paymentAccountName", account?.displayName ?? "");
                    setValue("paymentAccountType", account?.type);
                  }}
                >
                  <option value="">Select bank account</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.displayName}</option>
                  ))}
                </select>
                {errors.paymentAccountId ? <p className="text-sm text-destructive">{errors.paymentAccountId.message}</p> : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <RequiredLabel htmlFor="journal-amount">Amount</RequiredLabel>
              <Input
                id="journal-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                {...register("amount", { valueAsNumber: true })}
              />
              {errors.amount ? <p className="text-sm text-destructive">{errors.amount.message}</p> : null}
            </div>

            {isZelle ? (
              <>
                <div className="space-y-2">
                  <RequiredLabel htmlFor="journal-zelle-date">Zelle transaction date</RequiredLabel>
                  <Input id="journal-zelle-date" type="date" {...register("zelleTransactionDate")} />
                  {errors.zelleTransactionDate ? (
                    <p className="text-sm text-destructive">{errors.zelleTransactionDate.message}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <RequiredLabel htmlFor="journal-zelle-name">
                    Zelle transaction name (as it appears in bank account)
                  </RequiredLabel>
                  <Input
                    id="journal-zelle-name"
                    placeholder="Enter Zelle transaction name"
                    {...register("zelleTransactionName")}
                  />
                  {errors.zelleTransactionName ? (
                    <p className="text-sm text-destructive">{errors.zelleTransactionName.message}</p>
                  ) : null}
                </div>
              </>
            ) : null}

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="journal-description">Description</Label>
              <textarea
                id="journal-description"
                rows={3}
                placeholder="Enter description (optional)"
                className={cn(selectClassName, "h-auto py-2 bg-card")}
                {...register("description")}
              />
            </div>
          </div>
          )}
        </FormSection>
      </FormBody>
    </form>
  );
}
