"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { FormBody, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTransactionTypeOption } from "@/lib/accounting/daily-income/transaction-type-config";
import { dailyIncomeJournalSchema } from "@/lib/accounting/daily-income/schemas";
import type { AccountingLookup, ChartAccount, DailyIncomeJournalValues, JournalTransactionType } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import type { Invoice } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

type Props = {
  transactionType: JournalTransactionType;
  initialValues: DailyIncomeJournalValues;
  employees: Employee[];
  accounts: ChartAccount[];
  invoices: Invoice[];
  paymentMethods: AccountingLookup[];
  formId: string;
  showTypeSummary?: boolean;
  onSubmit: (values: DailyIncomeJournalValues) => void;
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
  invoices,
  paymentMethods,
  formId,
  showTypeSummary = false,
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

  const type = watch("transactionType");
  const employeeId = watch("employeeId");
  const invoiceId = watch("invoiceId");
  const accountId = watch("accountId");
  const sourceAccountId = watch("sourceAccountId");
  const paymentMethodId = watch("paymentMethodId");
  const needsInvoice = ["INITIAL-PAYMENT", "PAYMENT", "DISCOUNT", "SURCHARGE"].includes(type);
  const needsAccount = ["EXPENSE", "SALES", "TRANSFER", "LOAN"].includes(type);
  const needsPaymentMethod = needsInvoice || type === "SALES";
  const needsSourceAccount = type === "TRANSFER" || type === "EXPENSE" || type === "LOAN";

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        {showTypeSummary ? (
          <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3">
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
          <div className="grid gap-4 sm:grid-cols-2">
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

            {needsInvoice ? (
              <div className="space-y-2 sm:col-span-2">
                <RequiredLabel htmlFor="journal-invoice">Invoice</RequiredLabel>
                <select
                  id="journal-invoice"
                  className={selectClassName}
                  value={invoiceId ?? ""}
                  onChange={(event) => {
                    const invoice = invoices.find((item) => item.invoiceId === event.target.value);
                    setValue("invoiceId", invoice?.invoiceId ?? "", { shouldValidate: true });
                    setValue("invoiceNumber", invoice?.invoiceNumber ?? "");
                  }}
                >
                  <option value="">Select invoice</option>
                  {invoices.map((invoice) => (
                    <option key={invoice.invoiceId} value={invoice.invoiceId}>
                      {invoice.invoiceNumber}
                    </option>
                  ))}
                </select>
                {errors.invoiceId ? (
                  <p className="text-sm text-destructive">{errors.invoiceId.message}</p>
                ) : null}
              </div>
            ) : null}

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
                  setValue("paymentMethodName", method?.name ?? "");
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

            <div className="space-y-2">
              <Label htmlFor="journal-reference">Reference number</Label>
              <Input id="journal-reference" placeholder="Enter reference number" {...register("refNumber")} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="journal-description">Description</Label>
              <textarea
                id="journal-description"
                rows={3}
                placeholder="Enter description (optional)"
                className={`${selectClassName} h-auto py-2`}
                {...register("description")}
              />
            </div>
          </div>
        </FormSection>
      </FormBody>
    </form>
  );
}
